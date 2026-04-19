import { Route, Routes } from "react-router-dom"
import Navbar from "./components/Navbar"
import HomePage from "./pages/HomePage/HomePage"
import SignUp from "./pages/SignUp/SignUpPage"
import LogIn from "./pages/LogInPage"
import OTP from "./pages/SignUp/OTP"
import Password from "./pages/SignUp/Password"
import Email from "./pages/Forgot/email"
import ChangePassowrd from "./pages/Forgot/password"
import {Toaster} from "sonner"
import BookDetailPage from "./pages/BookDetailPage"
import ChapterReadingPage from "./pages/ChapterReadingPage"
import AuthorProfilePage from "./pages/AuthorProfilePage"
import CreateBookPage from "./pages/CreateBookPage"
import EditBookPage from "./pages/EditBookPage"
import CreateChapterPage from "./pages/CreateChapterPage"
import EditChapterPage from './pages/EditChapterPage'
import AuthorDashboardPage from './pages/AuthorDashboardPage'


const App = () => {
  return (
    <div>
      {/* <Navbar /> */}
      <Toaster position="top-right" richColors />
      <Routes>

        {/* HomePage */}
        <Route path="/" element={<HomePage />} />
        <Route path="/comic/:slug" element={<BookDetailPage />} />
        <Route path="/comic/:slug/chapters/:chapterNo" element={<ChapterReadingPage />} />
        <Route path="/author/:authorId" element={<AuthorProfilePage />} />
        <Route path="/author/comic/create" element={<CreateBookPage />} />
        <Route path="/author/comic/:bookId/edit" element={<EditBookPage />} />
        <Route path="/author/comic/:bookId/chapter/create" element={<CreateChapterPage />} />
        <Route path="/author/comic/:bookId/chapter/:chapterId/edit" element={<EditChapterPage />} />
        <Route path="/author/dashboard" element={<AuthorDashboardPage />} />

        {/* Auth Pages */}
        <Route path="/login" element={<LogIn />} />
        <Route path="/signUp" element={<SignUp />} />
        <Route path="/OTP" element={<OTP />} />
        <Route path="/setPassword" element={<Password />} />

        {/* Forgot Password Pages */}
        <Route path="/forgot/email" element={<Email />} />
        <Route path="/forgot/changePassword" element={<ChangePassowrd />} />

      </Routes>
      

    </div>
  )
}

export default App