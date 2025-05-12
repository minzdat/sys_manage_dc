// src/App.tsx
import React, { ReactElement, lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { Spin } from "antd";

// Lazy load các component
const Login = lazy(() => import("./Pages/Login/Login"));
const Register = lazy(() => import("./Pages/Register/Register"));
const ManageRequest = lazy(() => import("./Pages/ManageRequest/ManageRequest"));
const AddRequest = lazy(() => import("./Components/AddRequest/AddRequest/addRequest"));
const DeviceInfoView = lazy(() => import("./Components/DeviceInfoView/DeviceInfoView"));
const Reports = lazy(() => import("./Components/Feedback/Reports"));

// Khai báo PrivateRoute trong cùng file
const PrivateRoute = ({ children }: { children: ReactElement }) => {
  const token = localStorage.getItem("Token");
  return token ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Suspense 
      fallback={
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '100vh' 
        }}>
          <Spin size="large"/>
        </div>
      }
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/addRequest" element={<AddRequest />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/device/:deviceId" element={<DeviceInfoView />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <ManageRequest />
            </PrivateRoute>
          }
        />
        {/* Route không hợp lệ sẽ tự điều hướng về trang chính */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Suspense>
  );
}

export default App;