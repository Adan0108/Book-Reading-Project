import { lazy, Suspense } from "react";
import { Route, Routes, Outlet, Link } from "react-router-dom";
import { Toaster } from "sonner";
import AuthorGuard from "./features/author/AuthorGuard";
import AccountGuard from "./features/account/AccountGuard";
import Header from "./pages/HomePage/Header";
import { useThemeStore } from "./store/useThemeStore";
const HomePage = lazy(() => import("./pages/HomePage/HomePage"));
const SignUp = lazy(() => import("./pages/SignUp/SignUpPage"));
const LogIn = lazy(() => import("./pages/LogInPage"));
const OTP = lazy(() => import("./pages/SignUp/OTP"));
const Password = lazy(() => import("./pages/SignUp/Password"));
const Email = lazy(() => import("./pages/Forgot/email"));
const ChangePassword = lazy(() => import("./pages/Forgot/password"));
const BookDetailPage = lazy(() => import("./pages/BookDetailPage"));
const ChapterReadingPage = lazy(() => import("./pages/ChapterReadingPage"));
const AuthorProfilePage = lazy(() => import("./pages/AuthorProfilePage"));
const CreateBookPage = lazy(() => import("./pages/CreateBookPage"));
const EditBookPage = lazy(() => import("./pages/EditBookPage"));
const CreateChapterPage = lazy(() => import("./pages/CreateChapterPage"));
const EditChapterPage = lazy(() => import("./pages/EditChapterPage"));
const AuthorDashboardPage = lazy(() => import("./pages/AuthorDashboardPage"));
const AuthorApplicationPage = lazy(
  () => import("./pages/AuthorApplicationPage"),
);
const AdminApplicationsPage = lazy(
  () => import("./pages/AdminApplicationsPage"),
);
const AuthorMembershipsPage = lazy(
  () => import("./pages/AuthorMembershipsPage"),
);
const AdminMembershipPolicyPage = lazy(
  () => import("./pages/AdminMembershipPolicyPage"),
);
const AuthorPlansPage = lazy(() => import("./pages/AuthorPlansPage"));
const MyMembershipsPage = lazy(() => import("./pages/MyMembershipsPage"));
const AuthorPostsPage = lazy(() => import("./pages/AuthorPostsPage"));
const AuthorFeedPage = lazy(() => import("./pages/AuthorFeedPage"));
const DonationPage = lazy(() => import("./pages/DonationPage"));
const PaymentHistoryPage = lazy(() => import("./pages/PaymentHistoryPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const AdminContentPage = lazy(() => import("./pages/AdminContentPage"));
const AdminReportsPage = lazy(() => import("./pages/AdminReportsPage"));
const AdminSettingsPage = lazy(() => import("./pages/AdminSettingsPage"));
const AdminAuditPage = lazy(() => import("./pages/AdminAuditPage"));
const AdminReconciliationPage = lazy(
  () => import("./pages/AdminReconciliationPage"),
);
const LibraryPage = lazy(() => import("./pages/LibraryPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const loading = (
  <div role="status" className="p-8">
    Loading page…
  </div>
);
function SiteLayout() {
  return (
    <>
      <Header />
      <Suspense fallback={loading}>
        <Outlet />
      </Suspense>
    </>
  );
}
export default function App() {
  const isDark = useThemeStore((s) => s.isDark);
  return (
    <>
      <Toaster position="top-right" theme={isDark ? "dark" : "light"} />
      <Suspense fallback={loading}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/comic/:slug" element={<BookDetailPage />} />
            <Route path="/author/:authorId" element={<AuthorProfilePage />} />
            <Route
              path="/author/:authorId/memberships"
              element={<AuthorPlansPage />}
            />
            <Route
              path="/author/:authorId/posts"
              element={<AuthorFeedPage />}
            />
            <Route path="/author/:authorId/donate" element={<DonationPage />} />
            <Route element={<AccountGuard />}>
              <Route
                path="/account/payments"
                element={<PaymentHistoryPage />}
              />
              <Route path="/account/messages" element={<ChatPage />} />
              <Route path="/account/library" element={<LibraryPage />} />
              <Route path="/account/profile" element={<ProfilePage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route
                path="/account/memberships"
                element={<MyMembershipsPage />}
              />
              <Route
                path="/account/author-application"
                element={<AuthorApplicationPage />}
              />
            </Route>
            <Route element={<AuthorGuard />}>
              <Route
                path="/author/dashboard"
                element={<AuthorDashboardPage />}
              />
              <Route
                path="/author/memberships"
                element={<AuthorMembershipsPage />}
              />
              <Route path="/author/posts" element={<AuthorPostsPage />} />
              <Route
                path="/author/payments"
                element={<PaymentHistoryPage author />}
              />
              <Route path="/author/profile" element={<ProfilePage author />} />
            </Route>
            <Route
              path="*"
              element={
                <main
                  id="main-content"
                  className="mx-auto max-w-3xl p-8 space-y-5"
                >
                  <h1 className="text-3xl font-bold">Page not found</h1>
                  <p>
                    This link is unavailable. Browse stories or return to your
                    library.
                  </p>
                  <Link className="btn btn-primary" to="/">
                    Browse stories
                  </Link>
                </main>
              }
            />
          </Route>
          <Route
            path="/comic/:slug/chapters/:chapterNo"
            element={<ChapterReadingPage />}
          />
          <Route element={<AuthorGuard />}>
            <Route path="/author/comic/create" element={<CreateBookPage />} />
            <Route
              path="/author/comic/:bookId/edit"
              element={<EditBookPage />}
            />
            <Route
              path="/author/comic/:bookId/chapter/create"
              element={<CreateChapterPage />}
            />
            <Route
              path="/author/comic/:bookId/chapter/:chapterId/edit"
              element={<EditChapterPage />}
            />
          </Route>
          <Route element={<AccountGuard role="ADMIN" />}>
            <Route
              path="/admin/applications"
              element={<AdminApplicationsPage />}
            />
            <Route
              path="/admin/membership-policy"
              element={<AdminMembershipPolicyPage />}
            />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/content" element={<AdminContentPage />} />
            <Route path="/admin/reports" element={<AdminReportsPage />} />
            <Route path="/admin/settings" element={<AdminSettingsPage />} />
            <Route path="/admin/audit" element={<AdminAuditPage />} />
            <Route
              path="/admin/reconciliation"
              element={<AdminReconciliationPage />}
            />
          </Route>
          <Route path="/login" element={<LogIn />} />
          <Route path="/signUp" element={<SignUp />} />
          <Route path="/OTP" element={<OTP />} />
          <Route path="/setPassword" element={<Password />} />
          <Route path="/forgot/email" element={<Email />} />
          <Route path="/forgot/changePassword" element={<ChangePassword />} />
        </Routes>
      </Suspense>
    </>
  );
}
