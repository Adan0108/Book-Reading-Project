import React, { useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, Navigation, EffectCoverflow } from 'swiper/modules';
import { slides } from '../../fakeData/slides';

const ChevronLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const ChevronRight = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const FeaturedSlider = () => {

  const [swiperLoaded, setSwiperLoaded] = useState(false);
  const prevRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative w-full max-w-7xl mx-auto py-10 px-4 group">

      {/* --- BUTTON OVERLAY LAYER (Keeps arrows in the middle) --- */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
        <div className="w-[70%] md:w-[60%] aspect-[16/9] relative flex items-center justify-between px-5">
          <button
            ref={prevRef}
            className="pointer-events-auto w-10 h-10 bg-white/90 text-purple-600 rounded-full shadow-lg flex items-center justify-center hover:bg-white hover:scale-110 transition-all duration-300 backdrop-blur-sm"
          >
            <ChevronLeft />
          </button>

          <button
            ref={nextRef}
            className="pointer-events-auto w-10 h-10 bg-white/90 text-purple-600 rounded-full shadow-lg flex items-center justify-center hover:bg-white hover:scale-110 transition-all duration-300 backdrop-blur-sm"
          >
            <ChevronRight />
          </button>
        </div>
      </div>

      {/* MAIN SLIDER */}
      <Swiper
        modules={[Autoplay, Pagination, Navigation, EffectCoverflow]}
        navigation={{
          prevEl: prevRef.current,
          nextEl: nextRef.current,
        }}
        onBeforeInit={(swiper) => {
          // @ts-ignore
          swiper.params.navigation.prevEl = prevRef.current;
          // @ts-ignore
          swiper.params.navigation.nextEl = nextRef.current;
        }}
        onInit={() => setSwiperLoaded(true)}
        effect={'coverflow'}
        grabCursor={true}
        centeredSlides={true}
        loop={true}
        slidesPerView={'auto'}
        spaceBetween={30}
        coverflowEffect={{
          rotate: 0,
          stretch: 0,
          depth: 100,
          modifier: 2.5,
          slideShadows: false,
        }}
        autoplay={{
          delay: 3500,
          disableOnInteraction: false,
        }}
        className="w-full py-8"
      >
        {slides.map((slide, idx) => (

          <SwiperSlide key={idx} className="!w-[70%] md:!w-[60%] aspect-[16/9] relative transition-all duration-300">
            {/* WE USE A RENDER FUNCTION HERE TO GET 'isActive' */}
            {({ isActive }) => (
              <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl relative">
                <img
                  src={slide.image}
                  alt={slide.title}
                  className="w-full h-full object-cover"
                />
                
                {/* LOGIC: 
                    If isActive is true -> opacity-100 (Visible)
                    If isActive is false -> opacity-0 (Hidden)
                */}
                <div className={`absolute inset-0 transition-opacity duration-300 ${isActive ? 'opacity-100' : 'opacity-0'}`}>
                  
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-90" />
                  
                  {/* Text Content */}
                  <div className="absolute bottom-6 left-6 text-white text-left z-10 pr-12">
                    <h2 className="text-xl md:text-3xl font-bold mb-2">{slide.title}</h2>
                    <p className="text-sm md:text-base text-gray-200 line-clamp-1 opacity-90">
                      {slide.description}
                    </p>
                  </div>
                  
                </div>

              </div>
            )}
          </SwiperSlide>

        ))}
      </Swiper>
      
    </div>
  )
}



export default FeaturedSlider