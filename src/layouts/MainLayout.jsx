import React from 'react'
import Navbar from '../components/Navbar'

/**
 * Main Layout Component
 */
const MainLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  )
}

export default MainLayout

