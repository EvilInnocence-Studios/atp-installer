import { DatabaseConfig } from '../../shared/types'

export interface CockroachCluster {
  id: string
  name: string
  state: string
  cloud_provider: string
  regions: Array<{ name: string; datacenters?: string[] }>
  cockroach_version: string
  plan: string
}

export async function listCockroachClusters(apiKey: string): Promise<CockroachCluster[]> {
  console.log('Main: listCockroachClusters called');
  const response = await fetch('https://cockroachlabs.cloud/api/v1/clusters', {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  })

  console.log('Main: listCockroachClusters response status:', response.status);

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to list clusters')
  }

  const data = await response.json()
  console.log('Main: listCockroachClusters data received, cluster count:', data.clusters?.length || 0);
  return data.clusters || []
}

export async function createCockroachCluster(apiKey: string, name: string): Promise<CockroachCluster> {
  console.log('Main: createCockroachCluster called', name);
  const response = await fetch('https://cockroachlabs.cloud/api/v1/clusters', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      provider: 'AWS',
      spec: {
        serverless: {
          regions: ['us-east-1']
        }
      }
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to create cluster')
  }

  const data = await response.json()
  return data
}

export async function getCockroachConnectionInfo(apiKey: string, clusterId: string): Promise<Partial<DatabaseConfig>> {
  // This is a bit tricky via API because password isn't returned.
  // We can get the host though.
  const response = await fetch(`https://cockroachlabs.cloud/api/v1/clusters/${clusterId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to get cluster details')
  }

  const cluster = await response.json()
  
  // For serverless, regions are objects in the API response.
  const regionObj = cluster.regions?.[0]
  const regionName = typeof regionObj === 'string' ? regionObj : (regionObj?.name || 'us-east-1')
  const cloud = (cluster.cloud_provider || 'AWS').toLowerCase()
  const shortId = cluster.id.substring(0, 4)

  return {
    host: `${cluster.name}-${shortId}.${cloud}.${regionName}.cockroachlabs.cloud`,
    port: 26257
  }
}

export async function listCockroachUsers(apiKey: string, clusterId: string): Promise<string[]> {
  console.log('Main: listCockroachUsers called', clusterId);
  const response = await fetch(`https://cockroachlabs.cloud/api/v1/clusters/${clusterId}/sql-users`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to list SQL users')
  }

  const data = await response.json()
  // The response typically contains a list of user objects with a 'name' field
  return data.users?.map((u: any) => u.name) || []
}

export async function createCockroachUser(apiKey: string, clusterId: string, name: string, password?: string): Promise<string> {
  const pwd = password || generatePassword(16)
  console.log('Main: createCockroachUser called', { clusterId, name });
  
  const response = await fetch(`https://cockroachlabs.cloud/api/v1/clusters/${clusterId}/sql-users`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name,
      password: pwd
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to create SQL user')
  }

  return pwd
}

export async function getClusterStatus(apiKey: string, clusterId: string): Promise<string> {
  console.log('Main: getClusterStatus called', clusterId);
  const response = await fetch(`https://cockroachlabs.cloud/api/v1/clusters/${clusterId}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  })

  console.log('Main: getClusterStatus response status:', response.status);

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to get cluster status')
  }

  const data = await response.json()
  console.log('Main: getClusterStatus data received:', data.state);
  return data.state
}

export async function listCockroachDatabases(apiKey: string, clusterId: string): Promise<string[]> {
  console.log('Main: listCockroachDatabases called', clusterId);
  const response = await fetch(`https://cockroachlabs.cloud/api/v1/clusters/${clusterId}/databases`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to list databases')
  }

  const data = await response.json()
  // data.databases is expected to be an array of objects with a 'name' field
  return data.databases?.map((db: any) => db.name) || []
}

export async function createCockroachDatabase(apiKey: string, clusterId: string, name: string): Promise<void> {
  console.log('Main: createCockroachDatabase called', { clusterId, name });
  const response = await fetch(`https://cockroachlabs.cloud/api/v1/clusters/${clusterId}/databases`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to create database')
  }
}

function generatePassword(length: number): string {
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+"
  let retVal = ""
  for (let i = 0, n = charset.length; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n))
  }
  return retVal
}
