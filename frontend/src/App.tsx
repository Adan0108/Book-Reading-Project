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


const App = () => {
  return (
    <div>
      {/* <Navbar /> */}
      <Toaster position="top-right" richColors />
      <Routes>

        {/* HomePage */}
        <Route path="/" element={<HomePage />} />

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