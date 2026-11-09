import React from "react";
import { Routes, Route } from "react-router-dom";
import { PublicLayout } from "../layouts/PublicLayout";
import { MemberPortalLayout } from "../layouts/MemberPortalLayout";
import { AdminLayout } from "../layouts/AdminLayout";
import { PublicHomePage } from "../modules/public-site/pages/PublicHomePage";
import { MemberPortalPage } from "../modules/member-portal/pages/MemberPortalPage";
import { AdminDashboardPage } from "../modules/admin/pages/AdminDashboardPage";
import { UserAccountsPage } from "../modules/admin/pages/UserAccountsPage";
import { LoginPage } from "../modules/auth/pages/LoginPage";
import { SignUpPage } from "../modules/auth/pages/SignUpPage";
import { ResetPasswordPage } from "../modules/auth/pages/ResetPasswordPage";
import { PendingApprovalPage } from "../modules/auth/pages/PendingApprovalPage";
import { RequireApprovedUser } from "../modules/auth/RequireApprovedUser";
import { RequireSuperadmin } from "../modules/auth/RequireSuperadmin";
import { NotFoundPage } from "../modules/public-site/pages/NotFoundPage";

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<PublicHomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route path="/forgot-password" element={<ResetPasswordPage mode="request" />} />
        <Route path="/reset-password" element={<ResetPasswordPage mode="update" />} />
        <Route path="/pending" element={<PendingApprovalPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route element={<RequireApprovedUser />}>
        <Route path="/portal" element={<MemberPortalLayout />}>
          <Route index element={<MemberPortalPage />} />
        </Route>

        <Route element={<RequireSuperadmin />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="users" element={<UserAccountsPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
};
