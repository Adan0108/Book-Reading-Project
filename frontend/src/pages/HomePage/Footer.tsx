import React from 'react'

const Footer = () => {
  return (
    <footer className="bg-gray-800 dark:bg-gray-950 text-gray-400 mt-12 py-8">
      <div className="container mx-auto max-w-7xl px-4 text-center">
        <p>&copy; 2025 Manga-Site. All rights reserved.</p>
        <p className="text-sm mt-2">
          This is a demo site. All content is for demonstration purposes.
        </p>
        <div className="flex justify-center gap-4 mt-4">
          <a href="#" className="hover:text-yellow-400">Terms of Service</a>
          <a href="#" className="hover:text-yellow-400">Privacy Policy</a>
          <a href="#" className="hover:text-yellow-400">Contact Us</a>
        </div>
      </div>
    </footer>
  )
}

export default Footer