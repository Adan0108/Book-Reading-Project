import React, {useState} from 'react'

type TabType = 'daily' | 'weekly' | 'monthly'

const topComicsData = generateTopComicsData();

const genres = [
  'Action', 'Adventure', 'Romance', 'Isekai', 'Fantasy', 'Comedy',
  'Drama', 'Manhwa', 'Shounen', 'Slice of Life', 'Martial Arts', 'Magic'
];

const Sidebar = () => {

  const [activeTab, setActiveTab] = useState<TabType>('daily');

  return (
    <div className = "sticky top-25 space-y-6">
      {/* Top Comics Module */}
      <div className = "bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <h3 className="text-xl font-bold mb-4">Top Comics</h3>

        {/* Tabs */}
        <div id = "tour-top-comics" className = "flex border-b mb-4">
          <button
            onClick={() => setActiveTab('daily')}
            className={`py-2 px-4 font-medium ml-4 ${
              activeTab === 'daily'
                ? 'text-yellow-500 border-b-2 border-yellow-500' // Active style
                : 'text-gray-500 dark:text-gray-400 hover:text-yellow-500' // Inactive style
            }`}
          >
            Mỗi Ngày
          </button>

          <button
            onClick={() => setActiveTab('weekly')}
            className={`py-2 px-4 font-medium ml-4 ${
              activeTab === 'weekly'
                ? 'text-yellow-500 border-b-2 border-yellow-500' // Active style
                : 'text-gray-500 dark:text-gray-400 hover:text-yellow-500' // Inactive style
            }`}
          >
            Mỗi Tuần
          </button>

          <button
            onClick={() => setActiveTab('monthly')}
            className={`py-2 px-4 font-medium ml-4 ${
              activeTab === 'monthly'
                ? 'text-yellow-500 border-b-2 border-yellow-500' // Active style
                : 'text-gray-500 dark:text-gray-400 hover:text-yellow-500' // Inactive style
            }`}
          >
            Mỗi Tháng
          </button>

        </div>

        {/* Top Comics List */}
        <ul className="space-y-3">
          {topComicsData[activeTab].map((comic, index) => (
            <li key={comic.id} className="flex items-center gap-3">
              <span className={`text-2xl font-bold w-6 text-center ${
                index === 0 ? 'text-red-500' : (index === 1 ? 'text-blue-500' : (index === 2 ? 'text-green-500' : 'text-gray-500'))
              }`}>
                {index + 1}
              </span>
              <div>
                <a href="#" className="font-medium hover:text-yellow-400">{comic.title}</a>
                <p className="text-sm text-gray-500 dark:text-gray-400">Chap {comic.chapter} • {comic.views} views</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Genres Module */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
        <h3 className="text-xl font-bold mb-4">Genres</h3>
        <div className="flex flex-wrap gap-2">
          {genres.map((genre) => (
            <a
              key={genre}
              href="#"
              className="bg-gray-200 dark:bg-gray-700 text-sm px-3 py-1 rounded-full hover:bg-yellow-500 hover:text-gray-900"
            >
              {genre}
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatViews(views: number): string {
  if (views >= 1000000) {
    // Round to one decimal place for millions
    return (views / 1000000).toFixed(1) + 'M';
  }
  if (views >= 1000) {
    // Round down for thousands
    return Math.floor(views / 1000) + 'K';
  }
  return views.toString();
}

function generateTopList(count: number, idStart: number): any[] {
  const list = [];
  for (let i = 0; i < count; i++) {
    const id = idStart + i;
    list.push({
      id: id,
      title: `Truyện ${id}`, // Matches your "Truyện 1", "Truyện 2" pattern
      chapter: `${Math.floor(Math.random() * 250) + 10}`, // Random chapter
      views: formatViews(Math.floor(Math.random() * 20000000) + 100000), // Random views
    });
  }
  return list;
}

function generateTopComicsData() {
  // Generate 3 items for each list, ensuring IDs are unique
  const daily = generateTopList(3, 1);   // IDs 1, 2, 3
  const weekly = generateTopList(3, 4);  // IDs 4, 5, 6
  const monthly = generateTopList(3, 7); // IDs 7, 8, 9

  return {
    daily,
    weekly,
    monthly,
  };
}

export default Sidebar