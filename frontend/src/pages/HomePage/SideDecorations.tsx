import React from 'react'

const SideDecorations = () => {
  return (
    // Only show on wide screens (2xl = 1536px+)
    <div className="pointer-events-none fixed inset-0 z-40 hidden 2xl:block overflow-hidden">
      
      {/* --- LEFT CAT (Sitting/Standing) --- */}
      <div className="absolute bottom-0 w-35">
         {/* Optional: Add a subtle 'float' animation if the GIF is static-ish, 
             otherwise remove 'animate-bounce-slow' */}
         <div className="relative z-10 hover:scale-110 transition-transform duration-300">
            <img 
                src="https://media.tenor.com/sbfBfp3FeY8AAAAj/oia-uia.gif" 
                alt="Cat Left"
                className="w-full h-auto object-contain"
            />
          
         </div>
      </div>

      {/* --- RIGHT CAT (Mirrored) --- */}
      {/* We mirror the image so it looks like it's facing inward */}
      <div className="absolute bottom-0 right-0 w-35">
         <div className="relative z-10 transform -scale-x-100 hover:scale-110 transition-transform duration-300">
            <img 
                src="https://media.tenor.com/sbfBfp3FeY8AAAAj/oia-uia.gif" 
                alt="Cat Right"
                className="w-full h-auto object-contain"
            />
         </div>
      </div>

    </div>
  )
}

export default SideDecorations