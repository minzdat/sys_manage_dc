import React, { useState } from 'react';
import type { MenuProps } from 'antd';
import { Layout, Menu, theme } from 'antd';

import { FolderOpenOutlined, BarChartOutlined, SettingOutlined, FileTextOutlined } from '@ant-design/icons';

import { connect } from 'react-redux';
import "./AppSider.scss";
import { setTab, setStatus } from '../../Actions/requestAction';
import { RootState } from '../../Reducers/rootReducer';
import { useNavigate } from 'react-router';

const { Sider } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

function getItem(
    label: React.ReactNode,
    key: React.Key,
    icon?: React.ReactNode,
    children?: MenuItem[],
    type?: 'group',
): MenuItem {
    return {
        key,
        icon,
        children,
        label,
        type,
    } as MenuItem;
}

const AppSider = (props: any) => {
    const navigate = useNavigate();
    const userRole = localStorage.getItem('role'); 
    const { tab, setTab, setStatus } = props
    const items: MenuProps['items'] = [
        getItem('Yêu cầu', 'requests', <FolderOpenOutlined />, [
            getItem('Tất cả yêu cầu', 'get-all'),
            getItem('Thông tin thiết bị', 'get-devices'),
            getItem('Định danh chó(mèo)', 'get-pets'),
            getItem('Thông tin vi phạm', 'get-violations'),
            getItem('Thông tin tiêm phòng', 'get-vaccines'),
        ]),

        getItem('Trạng thái', 'status', <BarChartOutlined />, [
            getItem('Đang ghi thẻ', 'Writing'),
            getItem('Đang xử lý', 'Processing'),
            getItem('Đã hoàn thành', 'Active'),
            getItem('Chưa giải quyết', 'Pending'),
        ]),

        ...(userRole === 'admins' ? [
            getItem('Reports', 'reports', <FileTextOutlined />)
        ] : []),

    ];

    const profileItems: MenuProps['items'] = [

        getItem('Cài đặt', 'setting', <SettingOutlined />),

    ];

    const [openItem, setOpenItem] = useState('requests');

    const handleClick: MenuProps['onClick'] = (e) => {
        // Xử lý click menu trạng thái
        if (e.keyPath[1] === 'status') {
          props.setStatus(e.key);
          props.setTab(''); // Reset tab khi chọn status
        }
        // Xử lý click menu yêu cầu
        else if (e.keyPath[1] === 'requests') {
          props.setTab(e.key);
          props.setStatus(''); // Reset status khi chọn tab
        }
        // Xử lý các trường hợp khác
        else {
          props.setTab(e.key);
          props.setStatus('');
        }
      
        if (e.keyPath[0] === 'setting') {
          navigate('/setting');
        }

        if (e.key === 'reports') {
            navigate('/reports');
        }          
    };
    
    const [collapsed, setCollapsed] = useState(false);
    const {
        token: { colorBgContainer },
    } = theme.useToken();

    return (
        <div className='sider-layout'>
            <Sider
                collapsible
                collapsed={collapsed}
                onCollapse={(value) => setCollapsed(value)}
                style={{ background: colorBgContainer }}
                width={230}
                breakpoint='md'>
                <div>
                    <Menu
                        mode="inline"
                        defaultSelectedKeys={[tab]}
                        defaultOpenKeys={['requests']}
                        openKeys={[openItem]}
                        style={{ height: '100%' }}
                        items={props.profile ? profileItems : items}
                        onClick={handleClick}
                        onOpenChange={(openKey) => {
                            setOpenItem(openKey[1])
                        }}
                    />
                </div>
            </Sider>
        </div>
    )
}
const mapStateToProps = (state: RootState) => ({
    tab: state.request.tab,
    status: state.request.status
})

const mapDispatchToProps = { setTab, setStatus }

export default connect(mapStateToProps, mapDispatchToProps)(AppSider);
