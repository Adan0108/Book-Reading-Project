import React, { useState } from 'react'

type TabType = 'daily' | 'weekly' | 'monthly'

const topComicsData = generateTopComicsData();

const genres = [
  'Action', 'Adventure', 'Romance', 'Isekai', 'Fantasy', 'Comedy',
  'Drama', 'Manhwa', 'Shounen', 'Slice of Life', 'Martial Arts', 'Magic'
];

const Sidebar = () => {
  const [activeTab, setActiveTab] = useState<TabType>('daily');

  return (
    <div className="sticky top-4 space-y-6">
      
      {/* 1. New Animation Styles: Slide in from the left, one by one */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-10px); /* Start slightly to the left */
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        .animate-stagger {
          /* Start invisible (opacity-0) so we don't see them before animation starts */
          opacity: 0; 
          animation: slideIn 0.5s ease-out forwards;
        }
      `}</style>

      {/* Top Comics Module */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white uppercase flex items-center gap-2">
            <span className="text-yellow-500">★</span> Top Theo Dõi
          </h3>
        </div>

        {/* Tabs */}
        <div className="flex text-sm font-medium bg-gray-50 dark:bg-gray-700">
          <button
            onClick={() => setActiveTab('daily')}
            className={`flex-1 py-2 text-center transition-colors ${
              activeTab === 'daily'
                ? 'bg-white dark:bg-gray-800 text-yellow-600 border-t-2 border-yellow-500 font-bold' 
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Ngày
          </button>
          <button
            onClick={() => setActiveTab('weekly')}
            className={`flex-1 py-2 text-center transition-colors ${
              activeTab === 'weekly'
                 ? 'bg-white dark:bg-gray-800 text-yellow-600 border-t-2 border-yellow-500 font-bold' 
                 : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Tuần
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex-1 py-2 text-center transition-colors ${
              activeTab === 'monthly'
                 ? 'bg-white dark:bg-gray-800 text-yellow-600 border-t-2 border-yellow-500 font-bold' 
                 : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Tháng
          </button>
        </div>

        {/* Top Comics List */}
        {/* We keep key={activeTab} on the UL to reset the list when tab changes */}
        <ul key={activeTab} className="divide-y divide-gray-200 dark:divide-gray-700">
          {topComicsData[activeTab].map((comic: any, index: number) => (
            <li 
              key={comic.id} 
              // 2. Add 'animate-stagger' class
              className="flex items-start gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group animate-stagger"
              // 3. Dynamic Delay: Index * 100ms (0ms, 100ms, 200ms, etc.)
              style={{ animationDelay: `${index * 100}ms` }}
            >
              
              {/* Rank Number */}
              <div className={`text-xl font-bold w-6 text-center leading-none mt-1 ${
                index === 0 ? 'text-red-500' : (index === 1 ? 'text-green-500' : (index === 2 ? 'text-blue-500' : 'text-gray-400'))
              }`}>
                {index + 1}
              </div>

              {/* Thumbnail */}
              <div className="w-12 h-16 flex-shrink-0 rounded overflow-hidden shadow-sm relative">
                <img src={comic.imageUrl} alt={comic.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <a href="#" className="block text-sm font-bold text-gray-800 dark:text-gray-200 truncate group-hover:text-yellow-500 mb-1 transition-colors">
                  {comic.title}
                </a>
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>Chap {comic.chapter}</span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    {comic.views}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Genres Module */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white border-l-4 border-yellow-500 pl-2">Thể Loại</h3>
        <div className="flex flex-wrap gap-2">
          {genres.map((genre) => (
            <a
              key={genre}
              href="#"
              className="bg-gray-100 dark:bg-gray-700 text-xs px-3 py-1.5 rounded hover:bg-yellow-500 hover:text-white transition-colors text-gray-600 dark:text-gray-300"
            >
              {genre}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

// --- Helper Functions ---

function formatViews(views: number): string {
  if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
  if (views >= 1000) return Math.floor(views / 1000) + 'K';
  return views.toString();
}

function generateTopList(count: number, idStart: number): any[] {
  const list = [];
  for (let i = 0; i < count; i++) {
    const id = idStart + i;
    list.push({
      id: id,
      title: `Võ Luyện Đỉnh Phong ${id}`, 
      chapter: `${Math.floor(Math.random() * 500) + 1}`,
      views: formatViews(Math.floor(Math.random() * 20000000) + 100000),
      imageUrl: `https://img.buzzfeed.com/buzzfeed-static/static/2022-03/30/23/asset/c14c01274175/sub-buzz-532-1648681737-1.jpg?downsize=700%3A%2A&output-quality=auto&output-format=auto`, 
    });
  }
  return list;
}

function generateTopComicsData() {
  return {
    daily: generateTopList(5, 1),
    weekly: generateTopList(5, 10),
    monthly: generateTopList(5, 20),
  };
}

export default Sidebar