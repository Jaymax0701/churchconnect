import React from "react";
import { Routes, Route } from "react-router-dom";
import { PublicLayout } from "../layouts/PublicLayout";
import { MemberPortalLayout } from "../layouts/MemberPortalLayout";
import { AdminLayout } from "../layouts/AdminLayout";
import { PublicHomePage } from "../modules/public-site/pages/PublicHomePage";
import { MemberPortalPage } from "../modules/member-portal/pages/MemberPortalPage";
import { AdminDashboardPage } from "../modules/admin/pages/AdminDashboardPage";
import { LoginPage } from "../modules/auth/pages/LoginPage";
import { NotFoundPage } from "../modules/public-site/pages/NotFoundPage";

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* 1. Public Experience Area */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<PublicHomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      {/* 2. Member Portal Experience Area */}
      <Route element={<MemberPortalLayout />}>
        <Route path="/portal" element={<MemberPortalPage />} />
      </Route>

      {/* 3. Administration Dashboard Experience Area */}
      <Route element={<AdminLayout />}>
        <Route path="/admin" element={<AdminDashboardPage />} />
      </Route>
    </Routes>
  );
};
