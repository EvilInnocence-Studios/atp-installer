
import { X, Copy, Check, Globe } from 'lucide-react'
import { useState } from 'react'
import { AwsResourceStatus } from '../../../../shared/types'

interface DomainRecordsModalProps {
    isOpen: boolean
    onClose: () => void
    awsStatus: AwsResourceStatus[] | null
}

export function DomainRecordsModal({ isOpen, onClose, awsStatus }: DomainRecordsModalProps): JSX.Element | null {
    if (!isOpen) return null

    const loading = !awsStatus || awsStatus.some(s => s.status === 'Loading')
    const distributions = awsStatus?.filter(s => s.type === 'CloudFront' && s.status === 'Exists' && s.metadata?.DomainName) || []
    const certificate = awsStatus?.find(s => s.type === 'Certificate' && s.status === 'Exists')
    
    // Attempt to determine the root domain from the certificate ID or metadata
    // The certificate ID in checkAwsStatus is typically the domain name (e.g., example.com)
    const rootDomain = certificate?.id

    const formatAlias = (alias: string) => {
        if (!rootDomain) return alias
        if (alias === rootDomain) return '@'
        if (alias.endsWith(`.${rootDomain}`)) {
            return alias.slice(0, -1 * (rootDomain.length + 1))
        }
        return alias
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 z-50 animate-in fade-in duration-200">
            <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 duration-200">
                <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-gray-800 p-6 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-white flex items-center">
                        <Globe className="w-6 h-6 mr-3 text-blue-400" />
                        Domain Configuration Records
                    </h2>
                    <button 
                        onClick={onClose}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center text-gray-400">
                        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                        <p>Loading AWS Configuration...</p>
                    </div>
                ) : (
                <div className="p-8 space-y-8">
                    {/* DNS Records for SSL Validation */}
                    <div>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <span className="w-2 h-8 rounded-full bg-purple-500"></span>
                            SSL Certificate Validation
                        </h3>
                        <p className="text-sm text-gray-400 mb-4">
                            Add these CNAME records to your DNS provider to validate your SSL certificate. 
                            If you are using Route53, these may have been added automatically.
                        </p>
                        
                        {certificate ? (
                            certificate.details === 'ISSUED' ? (
                                <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-lg flex items-center gap-3">
                                    <div className="bg-green-500/20 p-2 rounded-full">
                                        <Check className="w-5 h-5 text-green-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-semibold">SSL Certificate is Active</h4>
                                        <p className="text-sm text-gray-400">Your certificate has been validated and issued. No further DNS changes are required for SSL.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-black/30 rounded-lg overflow-hidden border border-gray-800">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gray-800/50 text-gray-400 font-medium border-b border-gray-800">
                                            <tr>
                                                <th className="p-4">Name (Host)</th>
                                                <th className="p-4">Type</th>
                                                <th className="p-4">Value (Points to)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800">
                                            {(certificate?.metadata?.DomainValidationOptions as any[])?.map((opt, idx) => (
                                                <tr key={idx} className="hover:bg-gray-800/30 transition-colors">
                                                    <td className="p-4 font-mono text-blue-300 break-all">
                                                        <CopyableText text={opt.ResourceRecord?.Name || 'Pending...'} />
                                                    </td>
                                                    <td className="p-4 text-gray-300">
                                                        <span className="bg-gray-800 px-2 py-1 rounded border border-gray-700 font-mono text-xs">
                                                            {opt.ResourceRecord?.Type || 'CNAME'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 font-mono text-green-400 break-all">
                                                        <CopyableText text={opt.ResourceRecord?.Value || 'Pending...'} />
                                                    </td>
                                                </tr>
                                            )) || (
                                                <tr>
                                                    <td colSpan={3} className="p-8 text-center text-gray-500">
                                                        Validation details not available.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        ) : (
                            <div className="p-8 text-center border-2 border-dashed border-gray-800 rounded-xl text-gray-500">
                                SSL Certificate not found or not yet requested. Check AWS Status first.
                            </div>
                        )}
                    </div>

                    {/* DNS Records for CloudFront */}
                    <div>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <span className="w-2 h-8 rounded-full bg-blue-500"></span>
                            CloudFront Distributions
                        </h3>
                        <p className="text-sm text-gray-400 mb-4">
                            Create CNAME records to point your custom domains to these CloudFront distributions.
                        </p>

                        {distributions.length > 0 ? (
                            <div className="bg-black/30 rounded-lg overflow-hidden border border-gray-800">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-800/50 text-gray-400 font-medium border-b border-gray-800">
                                        <tr>
                                            <th className="p-4">Service</th>
                                            <th className="p-4">Your Custom Domain</th>
                                            <th className="p-4">Type</th>
                                            <th className="p-4">CloudFront Domain (Points to)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-800">
                                        {distributions.map((dist, idx) => {
                                            const aliases = dist.metadata?.Aliases || []
                                            // Fallback if no alias is found, though there should be one
                                            const displayAlias = aliases.length > 0 ? aliases[0] : 'No Alias Configured'
                                            const formattedAlias = formatAlias(displayAlias)
                                            
                                            return (
                                                <tr key={idx} className="hover:bg-gray-800/30 transition-colors">
                                                    <td className="p-4 font-medium text-white">
                                                        {dist.name}
                                                    </td>
                                                    <td className="p-4 font-mono text-blue-300 break-all">
                                                        <div className="flex items-center gap-2">
                                                            <CopyableText text={formattedAlias} />
                                                            {formattedAlias !== displayAlias && (
                                                                <span className="text-xs text-gray-500 hidden sm:inline-block">({displayAlias})</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-gray-300">
                                                        <span className="bg-gray-800 px-2 py-1 rounded border border-gray-700 font-mono text-xs">CNAME</span>
                                                    </td>
                                                    <td className="p-4 font-mono text-green-400 break-all">
                                                        <CopyableText text={dist.metadata?.DomainName} />
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8 text-center border-2 border-dashed border-gray-800 rounded-xl text-gray-500">
                                No CloudFront distributions found. Deploy your project first.
                            </div>
                        )}
                    </div>
                </div>
                )}
            </div>
        </div>
    )
}

function CopyableText({ text }: { text: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <button 
            onClick={handleCopy}
            className="group flex items-center gap-2 hover:bg-gray-800/50 px-2 py-1 rounded -ml-2 transition-all w-full text-left"
            title="Click to copy"
        >
            <span className="truncate">{text}</span>
            <span className={`opacity-0 group-hover:opacity-100 transition-opacity ${copied ? 'text-green-400' : 'text-gray-500'}`}>
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            </span>
        </button>
    )
}
