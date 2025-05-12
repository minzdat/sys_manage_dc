import React, { useState } from 'react';
import { Layout, theme } from 'antd';
import AppHeader from '../AppHeader';
import AppSider from '../AppSider';
import AppFooter from '../AppFooter';

import "./RequestLayout.scss";

const { Content } = Layout;

type RequestLayoutProps = {
    profile: boolean;
    children: () => React.ReactNode;
    onRowClick?: (record: any) => void; // <- dấu hỏi là quan trọng
};

const RequestLayout: React.FC<RequestLayoutProps> = ({ profile, children, onRowClick }) => {
    const {
        token: { colorBgContainer },
    } = theme.useToken();

    return (
        <div className='manage-request'>
            <AppHeader onRowClick={onRowClick} />
            <Content>
                <Layout style={{ backgroundColor: colorBgContainer }}>
                    <AppSider profile={profile} />
                    <Layout style={{ backgroundColor: colorBgContainer }}>
                        <Content style={{ minHeight: 280 }}>
                            {children()}
                        </Content>
                    </Layout>
                </Layout>
            </Content>
            <AppFooter />
        </div>


    );
};

export default RequestLayout;