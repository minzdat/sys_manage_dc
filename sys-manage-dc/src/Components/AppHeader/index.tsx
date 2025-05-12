import { Table, Spin, Col, Layout, Row, Button, Drawer, message, Badge, Menu, Avatar } from "antd";
import "./AppHeader.scss";
import { NavLink, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { QuestionOutlined, BellOutlined, MenuOutlined, CloseOutlined } from "@ant-design/icons";
import { connect } from 'react-redux';
import { RootState } from '../../Reducers/rootReducer';
import { setTab, setStatus, setUserInfo } from "../../Actions/requestAction";
import Feedback from "../Feedback/Feedback";
import { db } from "../../Firebase/FirebaseConfig"; 
import { collection, query, where, getDocs, limit, onSnapshot} from "firebase/firestore";
import { Modal, Form, Input, Radio, DatePicker } from "antd";
import dayjs from 'dayjs';
import { doc, updateDoc, getDoc } from "firebase/firestore";
import NotificationDropdown from "./NotificationDropdown";

const { Header } = Layout;

const Logo = () => (
    <svg width="180" height="40" viewBox="0 -10 180 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="28" fontFamily="Segoe UI, sans-serif" fontSize="26" fill="white" fontWeight="600">
        PetGuardian
      </text>
      <circle cx="15" cy="12" r="3" fill="white" />
      <circle cx="22" cy="10" r="2" fill="white" />
      <circle cx="10" cy="10" r="2" fill="white" />
      <circle cx="18" cy="6" r="2" fill="white" />
    </svg>
);
  
const AppHeader = (props: any) => {
    const { onRowClick } = props;
    const userID = localStorage.getItem("Id");
    const { userInfo, setUserInfo } = props;
    const avatarDefault = require('../../public/images/avatarDefault.png');
    const [openHelp, setOpenHelp] = useState(false);
    const [openProfile, setOpenProfile] = useState(false);
    const [openEditModal, setOpenEditModal] = useState(false);
    const [form] = Form.useForm();
    const [userDocRef, setUserDocRef] = useState<any>(null);
    const [openAccountModal, setOpenAccountModal] = useState(false);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [unsubscribeAccounts, setUnsubscribeAccounts] = useState<() => void>();
    const [userRole, setUserRole] = useState<string | null>(null);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [openNotifications, setOpenNotifications] = useState(false);
    const [unsubscribeNotifications, setUnsubscribeNotifications] = useState<() => void>();
    
    const navigate = useNavigate();

    const handlePathName = () => {
        window.location.reload();
    }

    const handleClickHelp = () => {
        setOpenHelp(!openHelp);
        setOpenProfile(false);
    }

    const handleClickSetting = () => {
        navigate('/setting');
    }

    const handleClickProfile = () => {
        setOpenProfile(!openProfile);
        setOpenHelp(false);
    }

    const handleClickMyProfile = () => {
        setOpenProfile(false); // đóng drawer
        setOpenEditModal(true); // mở modal
    }

    const onClose = () => {
        setOpenHelp(false);
        setOpenProfile(false);
    };

    const handleOpenAccountModal = async () => {
        setOpenProfile(false);
        setOpenAccountModal(true);
        await fetchProcessingAccounts(); // Khởi tạo listener khi mở modal
    };

    // Hàm fetch tài khoản có status Processing
    const fetchProcessingAccounts = async () => {
        setLoading(true);
        try {
            const collectionsToCheck = ["owners", "managers"];
            const allUnsubscribes: (() => void)[] = [];
        
            for (const col of collectionsToCheck) {
            const q = query(
                collection(db, col),
                where("status", "==", "Processing")
            );
            
            // Đăng ký listener và lưu unsubscribe function
            const unsubscribe = onSnapshot(q, (querySnapshot) => {
                const newAccounts: any[] = [];
                querySnapshot.forEach((doc) => {
                newAccounts.push({
                    id: doc.id,
                    collection: col,
                    ...doc.data(),
                    createdAt: doc.data().createAt
                });
                });
        
                // Cập nhật state accounts, merge dữ liệu từ các collection
                setAccounts(prev => [
                ...prev.filter(a => a.collection !== col), // Xóa dữ liệu cũ của collection
                ...newAccounts                             // Thêm dữ liệu mới
                ]);
            });
        
            allUnsubscribes.push(unsubscribe);
            }
        
            // Lưu tất cả unsubscribe functions để dọn dẹp sau này
            setUnsubscribeAccounts(() => () => {
            allUnsubscribes.forEach(unsub => unsub());
            });
        
        } catch (error) {
            message.error("Lỗi khi tải danh sách tài khoản");
        } finally {
            setLoading(false);
        }
    };
    
    const fetchNotifications = async () => {
        try {
          const q = query(
            collection(db, "notifications"),
            where("message", "==", "Notification")
          );
      
          const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const newNotifications: any[] = [];
            querySnapshot.forEach((doc) => {
              newNotifications.push({
                id: doc.id,
                ...doc.data(),
                createdAt: doc.data().createdAt
              });
            });
            setNotifications(newNotifications);
          });
      
          setUnsubscribeNotifications(() => unsubscribe);
        } catch (error) {
          message.error("Lỗi khi tải thông báo");
        }
    };

    useEffect(() => {
        if (openNotifications) {
          fetchNotifications();
        }
        
        return () => {
          if (unsubscribeNotifications) {
            unsubscribeNotifications();
          }
        };
    }, [openNotifications]);

    // Hàm này sẽ được gọi khi component mount và khi modal mở
    useEffect(() => {
        const role = localStorage.getItem("role");
        setUserRole(role);
    }, []);

    // Cleanup listener khi component unmount hoặc modal đóng
    useEffect(() => {
        return () => {
        if (unsubscribeAccounts) {
            unsubscribeAccounts(); // Hủy đăng ký listener
        }
        };
    }, [unsubscribeAccounts]);

    // Hàm duyệt tài khoản (cập nhật cho nhiều collections)
    const handleApproveAccount = async (account: any) => {
        try {
            const accountRef = doc(db, account.collection, account.id);
            await updateDoc(accountRef, {
                status: "Active",
                approvedBy: userInfo.Email,
                approvedAt: dayjs().format("YYYY-MM-DD HH:mm:ss")
            });
            message.success("Duyệt tài khoản thành công");
            fetchProcessingAccounts();
        } catch (error) {
            message.error("Duyệt tài khoản thất bại");
        }
    };

    
    // Trong component AppHeader, thêm useEffect để fetch data
    useEffect(() => {
        const fetchUserData = async () => {
            try {
            const email = localStorage.getItem("email");
            if (!email) return;
        
            const collections = ["owners", "managers", "admins"];
            for (const col of collections) {
                const q = query(
                    collection(db, col),
                    where("email", "==", email),
                    limit(1)
                );
                const snap = await getDocs(q);
                if (!snap.empty) {
                    const docSnap = snap.docs[0];
                    const data = docSnap.data();
                    setUserInfo({
                        FullName: data.fullName,
                        Email: data.email,
                        AvatarPath: data.avatarPath || "",
                        sex: data.sex || true,
                        birthday: data.birthday ? dayjs(data.birthday) : undefined,
                        phone: data.phone || '',
                        address: data.address || '',
                        cccd: data.cccd || '',
                        lastModifiedBy: data.lastModifiedBy || '',
                    });
                    setUserDocRef(doc(db, col, docSnap.id)); 
                    break;
                }
            }
            } catch (err) {
            console.error("Lỗi khi lấy thông tin người dùng:", err);
            }
        };
        
        if (userID) fetchUserData();
    }, [userID, setUserInfo]);
      
    const handleLogout = () => {
        localStorage.clear(); // Xóa token và uid
        message.success("Đăng xuất thành công!");
        navigate("/login", { replace: true }); // chuyển về login
    };  

    const handleUpdateFirestore = async (values: any) => {
        try {
            if (!userDocRef) throw new Error("User document reference not available");
    
            const formattedBirthday = values.birthday
                ? values.birthday.format("YYYY-MM-DDTHH:mm:ss")
                : null;
    
            const formattedUpdatedAt = dayjs().format("YYYY-MM-DDTHH:mm:ss");
    
            const updateData = {
                ...values,
                birthday: formattedBirthday,
                lastModifiedBy: userInfo.lastModifiedBy || "unknown",
                updateAt: formattedUpdatedAt,
            };
    
            await updateDoc(userDocRef, updateData);
            message.success("Cập nhật thành công!");
        } catch (error) {
            console.error("Lỗi khi cập nhật Firestore:", error);
            message.error("Cập nhật thất bại!");
        }
    };   
    
    // Cập nhật columns để hiển thị loại tài khoản
    const columns = [
        {
          title: "Loại tài khoản",
          dataIndex: "collection",
          key: "type",
          render: (text: string) => text === "owners" ? "Người dùng" : "Cơ quan quản lý",
          responsive: ['md'] as any,
          width: 100
        },
        {
          title: "Email",
          dataIndex: "email",
          key: "email",
          ellipsis: true,
          width: 150
        },
        {
          title: "Tên đầy đủ",
          dataIndex: "fullName",
          key: "fullName",
          ellipsis: true,
          width: 120
        },
        {
          title: "Ngày tạo",
          dataIndex: "createdAt",
          key: "createdAt",
          render: (text: string) => dayjs(text).format("DD/MM/YYYY"),
          width: 100,
          responsive: ['md'] as any
        },
        {
          title: "Hành động",
          key: "action",
          render: (_: any, record: any) => (
            <Button 
              type="primary" 
              onClick={() => handleApproveAccount(record)}
              style={{
                padding: window.innerWidth < 768 ? '2px 6px' : '4px 8px',
                fontSize: window.innerWidth < 768 ? '12px' : '14px'
              }}
            >
              Duyệt
            </Button>
          ),
          width: 80
        },
    ];

    return (
        <>
            <Header className="mcs-header">
                <Row className="row-header" gutter={[24, 24]}>
                    <Col xs={22}
                        sm={20}
                        md={16}
                        lg={16}
                        xl={16}
                        xxl={16}
                        className="col-logo">
                        <div className="col-logo-menu">
                            <Button className="btn-menu">
                                <MenuOutlined />
                            </Button>
                        </div>
                        <div onClick={handlePathName} className="col-logo-img">
                            <NavLink to="/">
                                <Logo />
                            </NavLink>
                        </div>
                        <div className="col-logo-label">
                            <p>PetHub</p>
                        </div>
                    </Col>

                    <Col xs={2}
                        sm={4}
                        md={8}
                        lg={8}
                        xl={8}
                        xxl={8}
                        className="col-function">
                        <Menu
                            className="group-btn"
                            mode="horizontal"
                            triggerSubMenuAction="click"
                            overflowedIndicatorPopupClassName="popup-menu"
                        // overflowedIndicator={<MenuOutlined />}
                        >
                            <Menu.Item className="function-menu-item" >
                                <Button className="btn-item" onClick={handleClickHelp}><QuestionOutlined /></Button>
                            </Menu.Item>

                            <Menu.Item className="function-menu-item">
                                <NotificationDropdown onRowClick={onRowClick || (() => {})} />
                            </Menu.Item>

                            <Drawer
                                className="dropdown-notifications"
                                placement="right"
                                open={openNotifications}
                                onClose={() => setOpenNotifications(false)}
                                mask={false}
                                closable={false}
                                >
                                <div className="title-dropdown">
                                    <span>Thông báo</span>
                                    <Button 
                                    className="header-btn-close" 
                                    onClick={() => setOpenNotifications(false)}
                                    >
                                    <CloseOutlined />
                                    </Button>
                                </div>
                                <div className="content-dropdown">
                                    {notifications.map(notification => (
                                    <div 
                                        key={notification.id} 
                                        className="notification-item"
                                        style={{ 
                                        padding: '8px',
                                        borderBottom: '1px solid #f0f0f0',
                                        marginBottom: '4px'
                                        }}
                                    >
                                        <p style={{ margin: 0 }}>{notification.content}</p>
                                        <small style={{ color: '#666' }}>
                                        {dayjs(notification.createdAt).format('DD/MM/YYYY HH:mm')}
                                        </small>
                                    </div>
                                    ))}
                                    {notifications.length === 0 && (
                                    <p style={{ textAlign: 'center', color: '#666' }}>Không có thông báo mới</p>
                                    )}
                                </div>
                            </Drawer>

                            <Menu.Item className="function-menu-item">
                                <Button onClick={handleClickProfile} className="btn-item">
                                    {userInfo.AvatarPath
                                        ? <Avatar
                                            shape='circle'
                                            size={32}
                                            src={`http://localhost:63642/${userInfo.AvatarPath}`}
                                            alt="avatar"></Avatar>
                                        : <Avatar
                                            shape='circle'
                                            size={32}
                                            src={String(avatarDefault)}
                                            alt="avatar"></Avatar>
                                    }
                                </Button>
                            </Menu.Item>

                        </Menu>
                        <Drawer
                            className="dropdown-help"
                            placement="right"
                            rootClassName="root-dropdown-help"
                            // onClose={onClose}
                            open={openHelp}
                            mask={false}
                            closable={false}
                        >
                            <div className="title-dropdown">
                                <span>Trợ giúp</span>
                                <Button className="header-btn-close" onClick={onClose}><CloseOutlined /></Button>
                            </div>
                            <div className="content-dropdown">
                                <h4 style={{ fontSize: '18px', fontFamily: 'Segoe UI', marginLeft: '10px' }}>Hỗ trợ PetGuardian</h4>
                                <NavLink to="/" style={{ textDecoration: 'none' }}>
                                    <p>Giới thiệu</p>
                                </NavLink>
                                <Feedback />
                                {/* <NavLink to="https://tasken.io/issue/new" style={{ textDecoration: 'none' }}>
                                    <p>Mở ticket</p>
                                </NavLink> */}
                                {/* <NavLink to="/" style={{ textDecoration: 'none' }}>
                                    <p>Trợ giúp</p>
                                </NavLink> */}
                            </div>
                        </Drawer>
                        <Drawer
                            className="dropdown-help"
                            placement="right" onClose={onClose}
                            open={openProfile}
                            mask={false}
                            closable={false}
                        >
                            <div className="title-dropdown">
                                <span>Tài khoản của tôi</span>
                                <Button className="header-btn-close" onClick={handleClickProfile}><CloseOutlined /></Button>
                            </div>
                            <div className="content-dropdown">
                                <div className="account-info">
                                    {userInfo.AvatarPath
                                        ? <img
                                            src={`http://localhost:63642/${userInfo.AvatarPath}`}
                                            alt="avatar"></img>
                                        : <img
                                            src={String(avatarDefault)}
                                            alt="avatar"></img>
                                    }
                                    <span className="info-name">{userInfo.FullName}</span>
                                    <br />
                                    <span className="info-email">{userInfo.Email}</span>
                                </div>
                                <div className="content-info">
                                    <div className='my-profile' style={{ textDecoration: 'none' }} onClick={handleClickMyProfile}>
                                        <p>Chỉnh sửa hồ sơ</p>
                                    </div>
                                    {userRole === "admins" && (
                                        <div className='my-profile' style={{ textDecoration: 'none' }} onClick={handleOpenAccountModal}>
                                            <p>Duyệt tài khoản</p>
                                        </div>
                                    )}
                                    <Modal
                                        title="Quản lý tài khoản chờ duyệt"
                                        open={openAccountModal}
                                        onCancel={() => {
                                            setOpenAccountModal(false);
                                            if (unsubscribeAccounts) unsubscribeAccounts(); // Hủy listener khi đóng modal
                                        }}
                                        footer={null}
                                        width={window.innerWidth < 768 ? '90%' : 800}
                                        style={{
                                            top: 30,
                                            maxWidth: '100vw'
                                        }}
                                        styles={{
                                            body: { 
                                            maxHeight: '70vh',
                                            overflowY: 'auto',
                                            padding: '12px 16px'
                                            }
                                        }}
                                    >
                                        <Spin spinning={loading}>
                                            <Table
                                                columns={columns}
                                                dataSource={accounts}
                                                rowKey="id"
                                                pagination={{ pageSize: 5 }}
                                                scroll={{ x: 500 }}
                                                size={window.innerWidth < 768 ? 'small' : 'middle'}
                                                style={{
                                                    fontSize: window.innerWidth < 768 ? '12px' : '14px'
                                                }}
                                            />
                                        </Spin>
                                    </Modal>
                                    <NavLink
                                        to="#"
                                        onClick={(e) => {
                                            e.preventDefault(); 
                                            handleLogout();   
                                        }}
                                        style={{ textDecoration: 'none' }}
                                        >
                                        <p>Đăng xuất</p>
                                    </NavLink>
                                </div>
                            </div>
                        </Drawer>

                    </Col>
                </Row >
            </Header >

            <Modal
                title="Chỉnh sửa thông tin tài khoản"
                open={openEditModal}
                onCancel={() => setOpenEditModal(false)}

                onOk={() => {
                    form.validateFields().then(async (values) => {
                        try {
                            // Cập nhật Firestore với camelCase
                            await handleUpdateFirestore(values);
                            
                            // Cập nhật Redux store: Chuyển đổi camelCase -> PascalCase
                            setUserInfo({
                                ...userInfo,
                                FullName: values.fullName,   // 🚨 Chuyển đổi tên trường
                                Email: values.email,
                                sex: values.sex,
                                birthday: values.birthday,   // Giữ nguyên kiểu dayjs
                                phone: values.phone,
                                address: values.address,
                                cccd: values.cccd,
                            });
                
                            setOpenEditModal(false);
                        } catch (error) {
                            message.error("Cập nhật thất bại!");
                        }
                    });
                }}      
                okText="Lưu"
                cancelText="Hủy"
                // maskClosable={false}
                centered
                width={window.innerWidth < 768 ? '90%' : 500}
                // 👉 style để Modal không bị cắt
                style={{
                    maxHeight: '80vh',
                    overflow: 'hidden',
                    // top: 30,
                }}
                // 👉 style phần body để scroll được nếu nội dung dài
                styles={{
                    body: {
                      maxHeight: '60vh',
                      overflowY: 'auto',
                      padding: '16px',
                    }
                  }}
                >
                <Form
                    layout="vertical"
                    form={form}
                    initialValues={{
                        email: userInfo.Email,
                        fullName: userInfo.FullName,
                        sex: userInfo.sex || true,
                        birthday: userInfo.birthday,
                        phone: userInfo.phone,
                        address: userInfo.address,
                        cccd: userInfo.cccd,
                        // lastModifiedBy: userInfo.lastModifiedBy || "Admin",
                    }}
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
                        <Input placeholder="Nhập email của bạn" disabled/>
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
                        label="Giới tính"
                        name="sex"
                        rules={[{ required: true, message: 'Chọn giới tính' }]}
                        style={{ textAlign: 'center' }}
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
                        style={{ textAlign: 'center' }}
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
                        <Input placeholder="Nhập số căn cước công dân" disabled />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    )
}
const mapStateToProps = (state: RootState) => ({
    tab: state.request.tab,
    status: state.request.status,
    userInfo: state.request.userInfo
});

const mapDispatchToProps = { setTab, setStatus, setUserInfo };

export default connect(mapStateToProps, mapDispatchToProps)(AppHeader);