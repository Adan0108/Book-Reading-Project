import React, { useState } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react';
import { Thumbs, FreeMode, Navigation, Autoplay, Pagination } from 'swiper/modules';
import type { Swiper as SwiperCore } from 'swiper/types';
import { slides } from '../../fakeData/slides';
import 'swiper/swiper.css';

const FeaturedSlider = () => {

  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperCore | null>(null);

  return (
    <div className="relative w-full h-[75vh] bg-black text-white overflow-hidden">
      {/* MAIN SLIDER */}
      <Swiper
        modules={[Autoplay, Pagination, Thumbs]}
        thumbs={{ swiper: thumbsSwiper }}
        autoplay={{ delay: 3500 }}
        loop={true}
        pagination={{ clickable: true }}
        className="w-full h-full"
      >
        {slides.map((slide, idx) => (
          <SwiperSlide key={idx}>
            <div className="relative w-full h-full flex items-start justify-center bg-black">
              
              {/* MAIN IMAGE*/}
              <img
                src={slide.image}
                alt={slide.title}
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
          
              {/* DARK OVERLAY */}
              <div className="absolute inset-0 bg-black/50" />
          
              {/* TEXT CONTENT */}
              <div className="relative z-10 w-full flex items-start pt-20 px-10">
                <div className="max-w-xl">
                  <h2 className="text-4xl font-bold mb-3">{slide.title}</h2>
                  <p className="text-lg opacity-90 mb-4">{slide.description}</p>
                  <button className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 font-semibold rounded">
                    Xem ngay
                  </button>
                </div>
              </div>
          
            </div>
          </SwiperSlide>
        
        ))}
      </Swiper>

      {/* THUMBNAIL SCROLLER */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-[85%] pointer-events-auto">
        <Swiper
          modules={[FreeMode, Thumbs]}
          onSwiper={setThumbsSwiper}
          slidesPerView={"auto"}
          spaceBetween={8}
          freeMode={true}
          watchSlidesProgress={true}
          className="swiper-thumb-center"
        >
          {slides.map((slide, idx) => (
            <SwiperSlide key={idx} className="!w-36">
              <div className="relative w-full overflow-hidden rounded-md  flex items-center justify-center">
                <div className="pb-[56.25%]"></div> {/* Maintains 16:9 ratio */}
                <img
                  src={slide.image}
                  alt={slide.title}
                  className="absolute inset-0 w-full h-full object-contain rounded-b-xl"
                />
              </div>
            </SwiperSlide>
          
          ))}
        </Swiper>
      </div>

    </div>
  )
}



export default FeaturedSlider