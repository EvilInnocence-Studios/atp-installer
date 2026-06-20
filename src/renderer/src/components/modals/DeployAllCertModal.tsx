import { X, Copy, Check, ShieldAlert } from 'lucide-react'
import { useState } from 'react'

interface DeployAllCertModalProps {
    isOpen: boolean
    validationOptions: any[]
    onContinue: () => void
    onCancel: () => void
}

export function DeployAllCertModal({ isOpen, validationOptions, onContinue, onCancel }: DeployAllCertModalProps): JSX.Element | null {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 z-50 animate-in fade-in duration-200">
            <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 duration-200">
                <div className="sticky top-0 bg-gray-900/95 backdrop-blur border-b border-gray-800 p-6 flex justify-between items-center z-10">
                    <h2 className="text-xl font-bold text-white flex items-center">
                        <ShieldAlert className="w-6 h-6 mr-3 text-yellow-500" />
                        SSL Certificate Validation Required
                    </h2>
                    <button 
                        onClick={onCancel}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="p-8 space-y-6">
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-yellow-200">
                        <p>
                            <strong>Action Required:</strong> The deployment is paused. Your SSL Certificate has been requested but is pending validation. 
                            If your DNS is managed by a third-party registrar (like GoDaddy, Namecheap, etc.), you must add the following CNAME records to prove you own the domains.
                        </p>
                    </div>

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
                                {validationOptions && validationOptions.length > 0 ? (
                                    validationOptions.map((opt, idx) => (
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
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="p-8 text-center text-gray-500">
                                            Validation details not available.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="text-gray-400 text-sm">
                        <p className="mb-2"><strong>Next Steps:</strong></p>
                        <ol className="list-decimal pl-5 space-y-1">
                            <li>Copy the <strong>Name</strong> and <strong>Value</strong> above.</li>
                            <li>Go to your DNS provider's dashboard.</li>
                            <li>Create new <strong>CNAME</strong> records using these details.</li>
                            <li>Wait a few minutes (DNS propagation can take time).</li>
                            <li>Click the <strong>Continue</strong> button below to re-check the status and resume deployment.</li>
                        </ol>
                    </div>

                    <div className="flex gap-4 pt-6 border-t border-gray-800">
                        <button 
                            onClick={onContinue}
                            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                        >
                            I have added the records. Continue Deployment
                        </button>
                        <button 
                            onClick={onCancel}
                            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
                        >
                            Abort Deployment
                        </button>
                    </div>
                </div>
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
