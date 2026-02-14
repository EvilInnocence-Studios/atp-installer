export interface CheckResult {
  tool: string
  name: string
  installed: boolean
  description?: string
  version?: string
  error?: string
}

export interface AppConfig {
  projectName: string
  destination: string
  // Domain Configurations
  adminDomain: string
  publicDomain: string
  apiDomain: string
  modules: string[]
  advanced: Record<string, string>

  dbLocal: DatabaseConfig

  dbProd: DatabaseConfig
  selectedClusterId?: string | null
  awsProfile: string
  awsRegion: string
  awsAccountId: string
}

export interface DatabaseConfig {
  host: string
  port: number
  user: string
  pass: string
  name: string
}

export interface Repo {
  url: string
  branch: string
  repoName: string
}

type Project = 'api' | 'admin' | 'public'

export interface Module {
  id: string
  name: string
  description?: string
  required?: boolean
  repos: Record<Project, Repo[]>
  requiredModules?: string[]
}

export const AVAILABLE_MODULES: Module[] = [
  {
    id: 'core', name: 'Core Framework', description: 'The foundational framework for the ATP system.', required: true,
    repos: {
      api: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-core-api.git', branch: 'main', repoName: 'core' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-core-shared.git', branch: 'main', repoName: 'core-shared' }
      ],
      admin: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-core-ui.git', branch: 'main', repoName: 'core' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-core-shared.git', branch: 'main', repoName: 'core-shared' }
      ],
      public: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-core-ui.git', branch: 'main', repoName: 'core' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-core-shared.git', branch: 'main', repoName: 'core-shared' }
      ]
    }
  },
  {
    id: 'common', name: 'Common Utilities', description: 'Shared utilities and helper libraries.', required: true,
    repos: {
      api: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-common-api.git', branch: 'main', repoName: 'common' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-common-shared.git', branch: 'main', repoName: 'common-shared' }
      ],
      admin: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-common-ui.git', branch: 'main', repoName: 'common' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-common-shared.git', branch: 'main', repoName: 'common-shared' }
      ],
      public: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-common-ui.git', branch: 'main', repoName: 'common' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-common-shared.git', branch: 'main', repoName: 'common-shared' }
      ]
    }
  },
  {
    id: 'uac', name: 'Authentication (UAC)', description: 'User Authentication and Control system.', required: true,
    repos: {
      api: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-uac-api.git', branch: 'main', repoName: 'uac' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-uac-shared.git', branch: 'main', repoName: 'uac-shared' }
      ],
      admin: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-uac-ui.git', branch: 'main', repoName: 'uac' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-uac-shared.git', branch: 'main', repoName: 'uac-shared' }
      ],
      public: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-uac-ui.git', branch: 'main', repoName: 'uac' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-uac-shared.git', branch: 'main', repoName: 'uac-shared' }
      ]
    }
  },
  {
    id: 'theming', name: 'Theming Engine', description: 'Theming engine for customizable UI styles.', required: true,
    repos: {
      api: [],
      admin: [{ url: 'https://github.com/EvilInnocence-Studios/atp-theming-ui.git', branch: 'main', repoName: 'theming' }],
      public: [{ url: 'https://github.com/EvilInnocence-Studios/atp-theming-ui.git', branch: 'main', repoName: 'theming' }]
    }
  },
  
  // Required Apps
  {
    id: 'admin', name: 'Admin Interface', description: 'The administrative dashboard application.', required: true,
    repos: {
      api: [],
      admin: [{ url: 'https://github.com/EvilInnocence-Studios/atp-admin-core.git', branch: 'main', repoName: 'admin' }],
      public: []
    }
  },
  {
    id: 'public', name: 'Public Interface', description: 'The public-facing website application.', required: true,
    repos: {
      api: [],
      admin: [],
      public: [{ url: 'https://github.com/EvilInnocence-Studios/atp-public-core.git', branch: 'main', repoName: 'public' }]
    }
  },

  // Optional Features
  {
    id: 'store', name: 'E-Commerce Store', description: 'Full-featured e-commerce store with cart',
    repos: {
      api: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-store-api.git', branch: 'main', repoName: 'store' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-store-shared.git', branch: 'main', repoName: 'store-shared' }
      ],
      admin: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-store-ui.git', branch: 'main', repoName: 'store' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-store-shared.git', branch: 'main', repoName: 'store-shared' }
      ],
      public: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-store-ui.git', branch: 'main', repoName: 'store' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-store-shared.git', branch: 'main', repoName: 'store-shared' }
      ]
    }
  },
  {
    id: 'brokered-products', name: 'Brokered Products Plugin', description: 'Support for selling brokered items.',
    requiredModules: ['store'],
    repos: {
      api: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-brokered-products-plugin-api.git', branch: 'main', repoName: 'brokered-products-plugin' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-brokered-products-plugin-shared.git', branch: 'main', repoName: 'brokered-products-plugin-shared' }
      ],
      admin: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-brokered-products-plugin-ui.git', branch: 'main', repoName: 'brokered-products-plugin' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-brokered-products-plugin-shared.git', branch: 'main', repoName: 'brokered-products-plugin-shared' }
      ],
      public: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-brokered-products-plugin-ui.git', branch: 'main', repoName: 'brokered-products-plugin' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-brokered-products-plugin-shared.git', branch: 'main', repoName: 'brokered-products-plugin-shared' }
      ]
    }
  },
  {
    id: 'donation-products', name: 'Donation Products Plugin', description: 'Support for donation-based products.',
    requiredModules: ['store'],
    repos: {
      api: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-donation-products-plugin-api.git', branch: 'main', repoName: 'donation-products-plugin' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-donation-products-plugin-shared.git', branch: 'main', repoName: 'donation-products-plugin-shared' }
      ],
      admin: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-donation-products-plugin-ui.git', branch: 'main', repoName: 'donation-products-plugin' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-donation-products-plugin-shared.git', branch: 'main', repoName: 'donation-products-plugin-shared' }
      ],
      public: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-donation-products-plugin-ui.git', branch: 'main', repoName: 'donation-products-plugin' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-donation-products-plugin-shared.git', branch: 'main', repoName: 'donation-products-plugin-shared' }
      ]
    }
  },
  {
    id: 'subscription', name: 'Subscriptions', description: 'Subscription management system.',
    repos: {
      api: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-subscription-api.git', branch: 'main', repoName: 'subscription' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-subscription-shared.git', branch: 'main', repoName: 'subscription-shared' }
      ],
      admin: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-subscription-ui.git', branch: 'main', repoName: 'subscription' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-subscription-shared.git', branch: 'main', repoName: 'subscription-shared' }
      ],
      public: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-subscription-ui.git', branch: 'main', repoName: 'subscription' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-subscription-shared.git', branch: 'main', repoName: 'subscription-shared' }
      ]
    }
  },
  {
    id: 'subscription-products', name: 'Subscription Products Plugin', description: 'Support for subscription-based products.',
    requiredModules: ['store', 'subscription'],
    repos: {
      api: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-subscription-products-plugin-api.git', branch: 'main', repoName: 'subscription-products-plugin' }
      ],
      admin: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-subscription-products-plugin-ui.git', branch: 'main', repoName: 'subscription-products-plugin' }
      ],
      public: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-subscription-products-plugin-ui.git', branch: 'main', repoName: 'subscription-products-plugin' }
      ]
    }
  },
  {
    id: 'webcomic', name: 'Web Comic', description: 'Web comic management and reader.',
    repos: {
       api: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-comic-api.git', branch: 'main', repoName: 'comic' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-comic-shared.git', branch: 'main', repoName: 'comic-shared' }
       ],
       admin: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-comic-ui.git', branch: 'main', repoName: 'comic' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-comic-shared.git', branch: 'main', repoName: 'comic-shared' }
       ],
       public: [
        { url: 'https://github.com/EvilInnocence-Studios/atp-comic-ui.git', branch: 'main', repoName: 'comic' },
        { url: 'https://github.com/EvilInnocence-Studios/atp-comic-shared.git', branch: 'main', repoName: 'comic-shared' }
       ]
    }
  }
]

export interface AwsResourceStatus {
  name: string
  type: 'S3' | 'CloudFront' | 'Lambda' | 'Certificate' | 'IAM Role'
  id: string
  status: 'Exists' | 'Missing' | 'Error' | 'Loading'
  details?: string
}
