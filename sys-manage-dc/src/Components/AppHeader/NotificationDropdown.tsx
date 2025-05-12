import { BellOutlined, CloseOutlined } from "@ant-design/icons";
import { Badge, Button, Dropdown, List, Spin } from "antd";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../Firebase/FirebaseConfig";
import dayjs from "dayjs";
import "./index.css";
import "./AppHeader.scss";
import { RequestType } from '../../Pages/ManageRequest/ManageRequest';

type Notification = {
    id: string;
    petId: string;
    time: string; 
};

type NotificationDropdownProps = {
    onRowClick: (record: RequestType, source?: 'notification' | 'table') => void;
};

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ onRowClick }) => {
    const [notifications, setNotifications] = useState<any[]>([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [unsubscribe, setUnsubscribe] = useState<() => void>();

    useEffect(() => {
        // Fetch notifications ngay khi component mount
        setLoading(true);
        try {
            const q = query(
                collection(db, "notifications"),
                where("message", "==", "Notification")
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const newNotifications = snapshot.docs.map(doc => ({
                    id: doc.id,
                    petId: doc.data().petId,
                    time: doc.data().time
                }));
                setNotifications(newNotifications);
                setLoading(false);
            });

            setUnsubscribe(() => unsubscribe);
        } catch (error) {
            console.error("Lỗi tải thông báo:", error);
            setLoading(false);
        }

        // Cleanup listener khi component unmount
        return () => unsubscribe?.();
    }, []);

    const fetchNotifications = () => {
        setLoading(true);
        try {
            const q = query(
                collection(db, "notifications"),
                where("message", "==", "Notification")
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const newNotifications = snapshot.docs.map(doc => ({
                    id: doc.id,
                    petId: doc.data().petId,
                    time: doc.data().time // Lấy trường time từ Firestore
                }));
                setNotifications(newNotifications);
            });

            setUnsubscribe(() => unsubscribe);
        } catch (error) {
            console.error("Lỗi tải thông báo:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open) fetchNotifications();
        return () => unsubscribe?.();
    }, [open]);

    const handleRefreshNotifications = () => {
        // Optional: Thêm logic refresh nếu cần
        if (!open) fetchNotifications();
    };

    // Trong phần JSX
    const menu = (
        <div className="custom-dropdown">
            <div className="notification-header">
                <span className="notification-title">Thông báo</span>
                <Button 
                    icon={<CloseOutlined />} 
                    type="text" 
                    onClick={() => setOpen(false)}
                />
            </div>
        
            <Spin spinning={loading}>
                <List
                    dataSource={notifications}
                    renderItem={(item) => (
                        <List.Item 
                            className="notification-item"
                            onClick={() => {
                                setOpen(false); // 1. Đóng dropdown
                                setTimeout(() => {
                                  const fakeRequest: RequestType = {
                                    id: item.petId,
                                    type: 'Định danh chó(mèo)',
                                    status: 'Đã hoàn thành',
                                    requestCode: '',
                                    createdBy: '',
                                    createdAt: '',
                                    lastModifiedBy: '',
                                    lastUpdateTime: ''
                                  };
                                  onRowClick(fakeRequest, 'notification'); // 2. Mở modal sau khi dropdown đóng
                                }, 300); // Delay nhỏ đảm bảo dropdown đóng trước
                            }}
                        >
                            <List.Item.Meta
                                title={<strong>{`Định danh chó(mèo) ${item.petId}`}</strong>}
                                description={
                                    <span className="time-stamp">
                                        {/* Chuyển đổi chuỗi time sang Date */}
                                        {dayjs(new Date(item.time)).format("DD/MM HH:mm")}
                                    </span>
                                }
                            />
                        </List.Item>
                    )}
                    locale={{ emptyText: "Không có thông báo" }}
                />
            </Spin>
        </div>
    );

    return (
        <Dropdown
            overlay={menu}
            trigger={["click"]}
            visible={open}
            onVisibleChange={(visible) => {
                setOpen(visible);
                if (visible) handleRefreshNotifications();
            }}
            overlayClassName="notification-dropdown"
        >
            <Badge count={notifications.length} overflowCount={99}>
            <Button 
                className="btn-item" 
                icon={<BellOutlined />} 
            />
            </Badge>
        </Dropdown>
    );
};

export default NotificationDropdown;