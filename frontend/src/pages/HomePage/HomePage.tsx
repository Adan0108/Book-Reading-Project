import React from 'react'
import  Header  from './Header';
import  Footer  from './Footer';
import  FeaturedSlider from './FeaturedSlider';
import  ComicGrid  from './ComicGrid';
import  Sidebar  from './Sidebar';
import {driver} from 'driver.js';
import 'driver.js/dist/driver.css';
import { useAuthStore } from '../../store/useAuthStore';
import type { AuthState } from '../../type/store';

const driverObj = driver({
  steps: [
    {
      element: '#tour-search-bar',
      popover: {
        title: 'Search Here',
        description: 'You can find your favorite comics in an instant using the search bar',
      }
    },

    { 
      element: '#tour-top-comics',
      popover: { 
        title: 'Top Comics', 
        description: 'See what comics are trending daily, weekly, or monthly.' 
      } 
    },

    { 
      element: '#tour-comic-grid',
      popover: { 
        title: 'Latest Updates', 
        description: 'Browse all the latest comic chapters as they are released right here.' 
      } 
    },

    {
      popover: {
        title: 'Tour Complete!',
        description: 'You\'re all set. Enjoy exploring the site!'
      }
    }
  ]
})

const HomePage = () => {

  const authUser = useAuthStore((state: AuthState) => state.authUser);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <Header onStartTour = {handleStartTour} authUser={authUser}/>

      {/* Featured Slider - Full width above the columns */}
      <FeaturedSlider />

      {/* Main Content Area */}
      <main className="container mx-auto max-w-7xl p-4">

        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Main Column (Latest Updates) */}
          <div className="w-full lg:w-2/3">
            <ComicGrid title="Latest Updates" />
          </div>

          {/* Sidebar */}
          <aside className="w-full lg:w-1/3">
            <Sidebar />
          </aside>
          
        </div>
      </main>

      <Footer />
    </div>
  )
}

function handleStartTour() {
  driverObj.drive(); // This one command starts the whole tour
}

export default HomePage