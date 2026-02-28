/**
 * School Configuration
 * Contains school-specific branding and configuration
 * This is the ONLY file that needs to be changed for different schools
 */

import schoolLogo from '@/assets/batch-logo1.png'

export const schoolConfig = {
  // School Identity
  logo: schoolLogo, // Using the specifically requested batch-logo1.png
  batchLogo: '/logo.png',
  name: 'BatchCrick BD',
  shortName: 'BatchCrick',

  // App Branding
  appName: 'BatchCrick',
  appFullName: 'BatchCrick - Professional Cricket Platform',

  // Slogan & Tagline
  slogan: 'Hearts of the local cricket',
  tagline: 'Fastest Score • Deep Insights',

  // School Colors (Professional Green Theme)
  colors: {
    primary: 'emerald', // emerald-600, emerald-700, etc.
    secondary: 'teal',
    accent: 'green',
    neutral: 'slate'
  },

  // Visual Elements
  emoji: {
    primary: '🏏',
    school: '🏟️',
    trophy: '🏆'
  },

  // School Context
  focus: [
    'General Cricket',
    'District Tournaments',
    'Club Cricket',
    'Inter-Batch Competitions'
  ],

  // Footer Message
  footer: {
    dedication: 'Dedicated to the Cricket Community of Bangladesh',
    tagline: 'Celebrating Cricket Passion Nationwide',
    description: 'A comprehensive cricket platform built to celebrate and preserve the spirit of cricket in Bangladesh.'
  },

  // Hero Section
  hero: {
    welcomeMessage: 'Welcome to',
    description: '',
    features: [
      'Fastest Live Score',
      'Detailed Player Statistics',
      'Pro Tournament Management',
      'Historical Records'
    ]
  }
}

// Helper function to get color classes
export const getColorClass = (type: 'primary' | 'secondary' | 'accent', shade: number = 600) => {
  const color = schoolConfig.colors[type]
  return `${color}-${shade}`
}

// Helper function to get gradient classes
export const getGradientClass = (type: 'primary' | 'secondary' | 'accent') => {
  const color = schoolConfig.colors[type]
  if (type === 'primary') return `from-${color}-600 to-${color}-700`
  if (type === 'secondary') return `from-${color}-500 to-${color}-600`
  return `from-${color}-600 to-${color}-700`
}

export default schoolConfig
