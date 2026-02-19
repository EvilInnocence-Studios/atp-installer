import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs-extra'
import { join } from 'path'

const execAsync = promisify(exec)

export interface AwsInitOptions {
  profile: string
  region: string
}

async function runAws(cmd: string, options: AwsInitOptions): Promise<any> {
  const { stdout } = await execAsync(`aws ${cmd} --profile ${options.profile} --region ${options.region} --output json`)
  return stdout ? JSON.parse(stdout) : {}
}

/**
 * Creates an S3 bucket and configures it for public read access.
 */
export async function ensureS3Bucket(bucketName: string, options: AwsInitOptions): Promise<void> {
  try {
    // Check if bucket exists
    await runAws(`s3api head-bucket --bucket ${bucketName}`, options)
  } catch (e: any) {
    // Create bucket
    console.log(`Creating bucket ${bucketName}...`)
    await runAws(`s3api create-bucket --bucket ${bucketName}`, options)
    
    // Disable Block Public Access
    await runAws(`s3api put-public-access-block --bucket ${bucketName} --public-access-block-configuration "BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false"`, options)
    
    // Add Public Read Policy
    const policy = {
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "PublicRead",
          Effect: "Allow",
          Principal: "*",
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${bucketName}/*`]
        }
      ]
    }
    const policyStr = JSON.stringify(policy).replace(/"/g, '\\"')
    await runAws(`s3api put-bucket-policy --bucket ${bucketName} --policy "${policyStr}"`, options)
  }
}

/**
 * Ensures the IAM Role for Lambda/Edge Lambda exists with required policies.
 */
export async function ensureLambdaRole(roleName: string, options: AwsInitOptions): Promise<void> {
  const trustPolicy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: {
          Service: [
            "lambda.amazonaws.com",
            "edgelambda.amazonaws.com"
          ]
        },
        Action: "sts:AssumeRole"
      }
    ]
  }
  const trustPolicyStr = JSON.stringify(trustPolicy).replace(/"/g, '\\"')

  try {
    await runAws(`iam get-role --role-name ${roleName}`, options)
  } catch (e: any) {
    console.log(`Creating role ${roleName}...`)
    await runAws(`iam create-role --role-name ${roleName} --assume-role-policy-document "${trustPolicyStr}"`, options)
  }

  // Attach Managed Policy: AWSLambdaBasicExecutionRole
  await runAws(`iam attach-role-policy --role-name ${roleName} --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole`, options)

  // Inline Policy: CloudFront Invalidations + S3 Full Access + Lambda Edge replication
  const inlinePolicy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Action: ["cloudfront:CreateInvalidation", "cloudfront:GetDistribution", "cloudfront:GetDistributionConfig", "cloudfront:UpdateDistribution"],
        Resource: "*"
      },
      {
        Effect: "Allow",
        Action: "s3:*",
        Resource: "*"
      },
      {
        Effect: "Allow",
        Action: [
          "iam:CreateServiceLinkedRole",
          "lambda:GetFunction",
          "lambda:EnableReplication*",
          "cloudfront:UpdateDistribution"
        ],
        Resource: "*"
      }
    ]
  }
  const inlinePolicyStr = JSON.stringify(inlinePolicy).replace(/"/g, '\\"')
  await runAws(`iam put-role-policy --role-name ${roleName} --policy-name ATPFrameworkPermissions --policy-document "${inlinePolicyStr}"`, options)
}

/**
 * Requests an ACM certificate if it doesn't exist.
 */
export async function ensureCertificate(domainName: string, options: AwsInitOptions): Promise<string> {
  // ACM certificates for CloudFront MUST be in us-east-1
  const acmOptions = { ...options, region: 'us-east-1' }
  
  const res = await runAws(`acm list-certificates`, acmOptions)
  const existing = res.CertificateSummaryList?.find((c: any) => c.DomainName === domainName)
  
  if (existing) {
    return existing.CertificateArn
  }

  console.log(`Requesting certificate for ${domainName}...`)
  const requestRes = await runAws(`acm request-certificate --domain-name ${domainName} --validation-method DNS`, acmOptions)
  return requestRes.CertificateArn
}

/**
 * Runs the API project's cloudfront script to create a distribution.
 */
export async function ensureCloudFrontDistribution(apiPath: string, env: Record<string, string>): Promise<void> {
  console.log(`Running cloudfront script in ${apiPath}...`)
  
  // We need to pass environment variables to the script
  const { stdout } = await execAsync(`yarn cloudfront`, {
    cwd: apiPath,
    env: { ...process.env, ...env }
  })

  console.log(stdout)

  // Parse for DISTRIBUTION_ID
  const match = stdout.match(/DISTRIBUTION_ID=(.*)/)
  if (match && match[1]) {
    const distributionId = match[1].trim()
    console.log(`Captured Distribution ID: ${distributionId}`)

    // Update .env files in the project directory

    const envFiles = ['.env', '.env.prod']
    for (const file of envFiles) {
      const envPath = join(apiPath, file)
      if (await fs.pathExists(envPath)) {
        let content = await fs.readFile(envPath, 'utf-8')
        if (content.includes('CLOUDFRONT_DISTRIBUTION_ID=')) {
          content = content.replace(/CLOUDFRONT_DISTRIBUTION_ID=.*/, `CLOUDFRONT_DISTRIBUTION_ID=${distributionId}`)
        } else {
          content += `\nCLOUDFRONT_DISTRIBUTION_ID=${distributionId}\n`
        }
        await fs.writeFile(envPath, content)
        console.log(`Updated ${file} with Distribution ID ${distributionId}`)
      }
    }
  }
}
