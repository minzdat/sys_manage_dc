import React, { JSX } from 'react';
import { Menu, notification } from 'antd';
import {
    ArrowLeftOutlined,
    SaveOutlined,
    SendOutlined,
    WarningOutlined
} from '@ant-design/icons';
import './menuDeviceInfoView.css';
import { useNavigate } from 'react-router-dom';

const MenuAdd = (): JSX.Element => {
    const navigate = useNavigate();

    const getFormData = () => {
        const storedData = localStorage.getItem("Data");
        return storedData ? JSON.parse(storedData) : null;
    };

    const openNotification = () => {
        notification.info({
            message: <strong>Thao tác thất bại</strong>,
            description: 'Vui lòng điền đầy đủ thông tin vào biểu mẫu và thử lại.',
            placement: 'topRight',
            icon: <WarningOutlined style={{ color: '#FF0000' }} />,
        });
    };

    const handleSaveDraft = () => {
        const formData = getFormData();
        if (
            formData &&
            formData.ReceiverId &&
            formData.Mobile &&
            formData.CostCenter &&
            formData.TotalPassengers &&
            formData.PickTime &&
            formData.PickLocation &&
            formData.Destination &&
            formData.Reason &&
            formData.ListOfUserId?.length
        ) {
            const updatedData = { ...formData, Status: "Draft" };
            localStorage.setItem("Data", JSON.stringify(updatedData));
        } else {
            openNotification();
        }
    };

    const handleReturn = () => {
        navigate("/");
    };

    return (
        <div className='menu-detail-request'>
            <Menu mode="horizontal" className='fixed-menu'>
                <Menu.Item onClick={handleReturn} key="return" icon={<ArrowLeftOutlined />}>
                    Quay lại
                </Menu.Item>
            </Menu>
        </div>
    );
};

export default MenuAdd;
