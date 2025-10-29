import React from 'react'

const FeaturedSlider = () => {
  return (
    <div className="container mx-auto max-w-7xl p-4">
      <div className="relative w-full h-64 bg-gray-700 rounded-lg shadow-lg overflow-hidden">
        <img
          src="https://via.placeholder.com/1200x300?text=Featured+Comic+Slider"
          alt="Featured Comic"
          className="w-full h-full object-cover"
        />
        <div className="absolute bottom-0 left-0 p-4 bg-black bg-opacity-60">
          <h2 className="text-3xl font-bold text-white">Truyện mới</h2>
          <p className="text-gray-200">Chapter 123</p>
        </div>
      </div>
    </div>
  )
}

export default FeaturedSlider