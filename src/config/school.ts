/**
 * School Configuration
 * Contains school-specific branding and configuration
 * This is the ONLY file that needs to be changed for different schools
 */

import schoolLogo from '@/assets/logo-final.png'

export const schoolConfig = {
  // School Identity
  logo: schoolLogo,
  batchLogo: '/logo.png',
  name: 'Shalnagor Modern Academy',
  shortName: 'SMA',

  // App Branding
  appName: 'BatchCrick',
  appFullName: 'BatchCrick - Shalnagor Modern Academy',

  // Slogan & Tagline
  slogan: 'Preserving School Cricket Legacy Through Technology',
  tagline: 'Where Tradition Meets Innovation',

  // School Colors (Academic Green Theme)
  colors: {
    primary: 'emerald', // emerald-600, emerald-700, etc.
    secondary: 'teal',
    accent: 'green',
    neutral: 'slate'
  },

  // Visual Elements
  emoji: {
    primary: '🏏',
    school: '🎓',
    trophy: '🏆'
  },

  // School Context
  focus: [
    'School Cricket',
    'Batch Cricket',
    'Alumni Tournaments',
    'Inter-Batch Competitions'
  ],

  // Footer Message
  footer: {
    dedication: 'Dedicated to Shalnagor Modern Academy',
    tagline: 'Preserving Cricket Heritage Since Our Founding',
    description: 'A comprehensive cricket platform built to celebrate and preserve the cricket legacy of Shalnagor Modern Academy.'
  },

  // Hero Section
  hero: {
    welcomeMessage: 'Welcome to',
    description: '',
    features: [
      'Live Match Updates',
      'Player Statistics',
      'Tournament Management',
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
