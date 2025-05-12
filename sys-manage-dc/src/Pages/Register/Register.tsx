import { Input, Button, Form, Radio, message, DatePicker, Select } from "antd";
import "./index.css";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
// import request from "../../Utils/request";
import { auth, db } from "../../Firebase/FirebaseConfig"; 
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import moment from "moment";
import dayjs from 'dayjs';

interface RegisterValues {
    email: string;
    password: string;
    fullName: string;
    sex: boolean;
    birthday: moment.Moment;
    phone: string;
    address: string;
    cccd: string;
    role: string;
}

interface Role {
    Id: string;
    Title: string;
}  

const Register = () => {
    const navigate = useNavigate();
    const [dataRole, setDataRole] = useState<Role[]>([]);
    const [loading, setLoading] = useState(false);

    const handleRegister = async (values: RegisterValues) => {
        setLoading(true);
        try {
            // 1. Tạo tài khoản Authentication
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                values.email,
                values.password
            );

            // 2. Chuyển đổi ngày sinh sang Date
            const formattedBirthday = values.birthday.format("YYYY-MM-DDTHH:mm:ss");
            const currentTime = dayjs().format("YYYY-MM-DDTHH:mm:ss");

            // 3. Xác định collection và document ID
            const collectionName = values.role === 'user' ? 'owners' : 'managers';
            const docId = `${collectionName.slice(0, -1)}_${values.cccd}`; // owner_xxx hoặc manager_xxx

            // 4. Xác định lastModifiedBy theo collection
            const lastModifiedBy = `${collectionName.slice(0, -1)}_${values.cccd}`; // VD: owner_123456789
            const status = values.role === 'user' ? 'Active' : 'Processing';

            // 5. Chuẩn bị dữ liệu cho Firestore
            const userData = {
                email: values.email,
                fullName: values.fullName,
                sex: values.sex,
                birthday: formattedBirthday,
                phone: values.phone,
                address: values.address,
                cccd: values.cccd,
                lastModifiedBy: lastModifiedBy,
                createAt: currentTime,
                updateAt: currentTime,
                status: status
            };

            // 6. Lưu thông tin vào Firestore
            await setDoc(doc(db, collectionName, docId), userData);

            message.success('Đăng ký thành công!');
            navigate('/login');
        } catch (error: any) {
            console.error('Lỗi đăng ký:', error);
            
            let errorMessage = 'Đăng ký thất bại!';
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'Email đã được sử dụng';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Mật khẩu tối thiểu 6 ký tự';
                    break;
                case 'permission-denied':
                    errorMessage = 'Không có quyền thực hiện hành động này';
                    break;
                default:
                    errorMessage = error.message || errorMessage;
            }
            message.error(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    // const getAllRole = async () => {
    //     const endpoint = "role/all?page=1&limit=5";
    //     await request.get(endpoint).then((res) => {
    //         setDataRole(res.data.Data.ListData);
    //         setLoading(false);
    //     }).catch(() => {
    //         setLoading(true);
    //     });
    // }

    // useEffect(() => {
    //     getAllRole();
    // }, [])

    useEffect(() => {
        const mockRoles: Role[] = [
          { Id: "user", Title: "Người dùng" },
          { Id: "manager", Title: "Cơ quan quản lý" },
        ];
        setDataRole(mockRoles);
      }, []);
      

    return (
        <>
            <div className="register-page">
                <h2>Đăng ký tài khoản</h2>
                <Form className="register-form"
                    name="basic"
                    labelCol={{
                        span: 8,
                    }}
                    wrapperCol={{
                        span: 18,
                    }}
                    style={{
                        maxWidth: 600,
                    }}
                    initialValues={{
                        remember: true,
                    }}
                    autoComplete="off"
                    onFinish={handleRegister}
                >
                    <Form.Item
                        name="email"
                        label="E-mail"
                        rules={[
                            {
                                type: "email",
                                message: "Email không hợp lệ!",
                            },
                            {
                                required: true,
                                message: "Vui lòng nhập email!",
                            },
                        ]}
                    >
                        <Input placeholder="Nhập email của bạn" />
                    </Form.Item>

                    <Form.Item
                        label="Họ và tên"
                        name="fullName"
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng nhập đầy đủ họ tên của bạn!",
                            },
                        ]}
                    >
                        <Input placeholder="Nhập họ và tên của bạn" />
                    </Form.Item>

                    <Form.Item
                        name="sex"
                        label="Giới tính"
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng chọn giới tính!",
                            },
                        ]}
                    >
                        <Radio.Group>
                            <Radio value={true}>Nam</Radio>
                            <Radio value={false}>Nữ</Radio>
                        </Radio.Group>
                    </Form.Item>

                    <Form.Item
                        name="birthday"
                        label="Ngày sinh"
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng chọn ngày sinh!",
                            },
                        ]}
                    >
                        <DatePicker showTime format="YYYY-MM-DD HH:mm:ss" placeholder="Chọn ngày sinh"/>
                    </Form.Item>
                    
                    <Form.Item
                        name="phone"
                        label="Số điện thoại"
                        rules={[
                            { required: true, message: "Vui lòng nhập số điện thoại!" },
                            { pattern: /^[0-9]{10}$/, message: "Số điện thoại phải có 10 chữ số!" }
                        ]}
                    >
                        <Input placeholder="Nhập số điện thoại của bạn" />
                    </Form.Item>

                    <Form.Item
                        name="address"
                        label="Địa chỉ"
                        rules={[{ required: true, message: "Vui lòng nhập địa chỉ!" }]}
                    >
                        <Input placeholder="Nhập địa chỉ của bạn" />
                    </Form.Item>

                    <Form.Item
                        name="cccd"
                        label="Số CCCD"
                        rules={[
                            { required: true, message: "Vui lòng nhập số CCCD!" },
                            { pattern: /^[0-9]{12}$/, message: "Số CCCD phải có 12 chữ số!" }
                        ]}
                    >
                        <Input placeholder="Nhập số căn cước công dân" />
                    </Form.Item>

                    <Form.Item 
                    name="role" 
                    label="Vai trò" 
                    rules={[
                        {
                            required: true,
                            message: "Vui lòng chọn vai trò!",
                        },
                    ]}
                    initialValue={dataRole.length > 0 ? dataRole[0].Title : undefined}>
                        <Select
                            placeholder="Chọn vai trò của bạn"
                            showSearch
                            optionFilterProp="children"
                            filterOption={(inputValue, option) =>
                                option?.props.children?.toLowerCase().indexOf(inputValue.toLowerCase()) !== -1
                            }
                        >
                            {dataRole.map((items) => (
                                <Select.Option key={items.Id} value={items.Id} >
                                    {`${items.Title}`}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>

                    {/* <Form.Item  //Test register
                        label="Employee number"
                        name="employeenumber"
                        rules={[
                            {
                                required: true,
                                message: "Please input your employee number!",
                            },
                        ]}
                    >
                        <Input placeholder="Type your employee number" />
                    </Form.Item> */}

                    <Form.Item
                        label="Mật khẩu"
                        name="password"
                        hasFeedback
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng nhập mật khẩu!",
                            },
                            {
                                min: 6,
                                message: "Mật khẩu tối thiểu 6 ký tự!",
                            },
                        ]}
                    >
                        <Input.Password placeholder="Nhập mật khẩu" />
                    </Form.Item>

                    <Form.Item
                        name="confirm"
                        label="Xác nhận mật khẩu"
                        dependencies={["password"]}
                        hasFeedback
                        rules={[
                            {
                                required: true,
                                message: "Vui lòng xác nhận mật khẩu!",
                            },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue("password") === value) {
                                        return Promise.resolve();
                                    }
                                    return Promise.reject(
                                        new Error(
                                            "Mật khẩu xác nhận không khớp!"
                                        )
                                    );
                                },
                            }),
                        ]}
                    >
                        <Input.Password placeholder="Nhập lại mật khẩu" />
                    </Form.Item>

                    <Form.Item
                        wrapperCol={{
                            offset: 8,
                            span: 16,
                        }}
                    >
                        <Button type="primary" htmlType="submit">
                            Đăng ký
                        </Button>
                    </Form.Item>
                </Form>
            </div>
        </>
    );
};

export default Register;