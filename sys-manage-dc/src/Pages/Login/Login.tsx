import { Input, Button, Form, message, Spin } from "antd";
import {Link, useNavigate } from "react-router-dom";
import { useCallback, useState } from "react";
import { signOut, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../Firebase/FirebaseConfig";
import "./index.css";
import { getDocs, collection, query, where, limit } from "firebase/firestore";
import { db } from "../../Firebase/FirebaseConfig"; 

interface LoginValues {
  username: string; // Email
  password: string;
}

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Xử lý khi đăng nhập thành công
  const handleSuccessLogin = async (user: any) => {
    const token = await user.getIdToken();
    const userEmail = user.email || ""; // Handle case email null
    
    localStorage.setItem("Token", token);
    localStorage.setItem("Id", user.uid);
    localStorage.setItem("email", userEmail); // Lưu email
    
    message.success("Đăng nhập thành công!");
    navigate("/");
  };

  const checkUserStatusAndRole = async (
    email: string
  ): Promise<{ status: string; role: string } | null> => {
    const colNames = ["owners", "managers", "admins"] as const;
    for (const name of colNames) {
      const q = query(
        collection(db, name),
        where("email", "==", email),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        return {
          status: data.status as string, // ví dụ "Active", "Inactive"
          role: name,
        };
      }
    }
    return null;
  };
  
  const handleLogIn = useCallback(async (values: LoginValues) => {
    setLoading(true);
    try {
      const { username, password } = values;
      // 1) Đăng nhập bằng Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, username, password);
      const user = userCredential.user;

      // 2) Kiểm tra status trong Firestore
      const email = user.email || "";
      const info = await checkUserStatusAndRole(email);

      if (!info) {
        // không tìm thấy trong bất kỳ collection nào
        await signOut(auth);
        message.error("Tài khoản không hợp lệ.");
        return;
      }
      const { status, role } = info;

      if (status !== "Active") {
        // nếu không active thì sign out và báo lỗi
        await signOut(auth);
        message.error(
          "Tài khoản của bạn chưa được kích hoạt. Vui lòng liên hệ quản trị viên."
        );
        return;
      }

      // 3) Nếu active, lưu thêm role rồi tiếp tục
      localStorage.setItem("role", role);
      await handleSuccessLogin(user);
    } catch (error: any) {
      let errorMsg = "Đăng nhập thất bại!";
      
      if (error.code) {
        switch (error.code) {
          case "auth/user-not-found":
            errorMsg = "Không tìm thấy tài khoản!";
            break;
          case "auth/wrong-password":
            errorMsg = "Mật khẩu không chính xác!";
            break;
          case "auth/invalid-email":
            errorMsg = "Địa chỉ email không hợp lệ!";
            break;
          case "auth/invalid-credential":
            errorMsg = "Thông tin đăng nhập không hợp lệ. Vui lòng kiểm tra lại tài khoản hoặc mật khẩu!";
            break;
          case "auth/user-disabled":
            errorMsg = "Tài khoản này đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.";
            break;
          case "auth/too-many-requests":
            errorMsg = "Bạn đã thử quá nhiều lần. Vui lòng chờ vài phút rồi thử lại.";
            break;
          case "auth/network-request-failed":
            errorMsg = "Không thể kết nối mạng. Vui lòng kiểm tra đường truyền Internet.";
            break;
          default:
            errorMsg = `Lỗi đăng nhập: ${error.message || "Không xác định"}`;
            break;
        }
      }
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
}, [navigate]);

  return (
    <Spin spinning={loading} size="large">
      <div className="login-page">
        <h2>Đăng nhập vào tài khoản của bạn</h2>
        <br />
        <Form
          className="login-form"
          name="login"
          labelCol={{ span: 8 }}
          wrapperCol={{ span: 16 }}
          style={{ maxWidth: 600 }}
          onFinish={handleLogIn}
        >
          <Form.Item
            label="Email"
            name="username"
            rules={[
              { required: true, message: "Vui lòng nhập email của bạn!" },
              { type: "email", message: "Email không hợp lệ!" },
            ]}
          >
            <Input placeholder="Nhập email của bạn" />
          </Form.Item>

          <Form.Item
            label="Mật khẩu"
            name="password"
            rules={[{ required: true, message: "Vui lòng nhập mật khẩu của bạn!" }]}
          >
            <Input.Password placeholder="Nhập mật khẩu của bạn" />
          </Form.Item>

          <Form.Item wrapperCol={{ offset: 8, span: 16 }}>
            <Button
              type="primary"
              htmlType="submit"
              id="btn-login"
              loading={loading}
            >
              Đăng nhập
            </Button>
            <div style={{ marginTop: 10, marginRight: 10 }}>
              Chưa có tài khoản? <Link to="/register">Đăng ký ngay</Link>
            </div>
          </Form.Item>
        </Form>
      </div>
    </Spin>
  );
};

export default Login;
