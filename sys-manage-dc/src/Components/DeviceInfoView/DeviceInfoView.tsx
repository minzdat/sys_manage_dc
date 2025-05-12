import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Spin,
  message,
  Tag,
  Typography
} from 'antd';
import {
  ScanOutlined,
  CodeOutlined,
  FireOutlined,
  ClockCircleOutlined,
  UsbOutlined,
  WifiOutlined,
  IdcardOutlined,
  CalendarOutlined,
  PoweroffOutlined,
  SyncOutlined,
  RocketOutlined,
  WarningOutlined
} from '@ant-design/icons';
import RequestLayout from '../../Components/RequestLayout';
import MenuAdd from './MenuDeviceInfoView/menuDeviceInfoView';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../Firebase/FirebaseConfig';
import './DeviceInfoView.css';

const { Title, Text } = Typography;

const DeviceInfoView: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const [loading, setLoading] = useState(true);
  const [device, setDevice] = useState<{
    acceptedCards: string;
    firmwareVersion: string;
    createAt: string;
    lastBootTime: string;
    lastUpdateTime: string;
    rfidModelType: string;
    rssi: number;
    startupInfo: string;
    temperatureCelsius: number;
    uptime: number;
  } | null>(null);

  function parseISODuration(duration: string): string {
    const regex = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
    const matches = duration.match(regex);
  
    if (!matches) return 'N/A';
  
    const [, days, hours, minutes, seconds] = matches.map((v) => parseInt(v) || 0);
  
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    if (seconds) parts.push(`${seconds}s`);
  
    return parts.join(' ');
  }
  
  useEffect(() => {
    if (!deviceId) {
      message.error('Thiếu ID thiết bị!');
      setLoading(false);
      return;
    }

    const docRef = doc(db, 'rfidReaderDevices', deviceId);
    const unsubscribe = onSnapshot(
      docRef,
      (docSnap) => {
        try {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const format = (d: any) => {
              const dt = d?.toDate?.() || new Date(d);
              return isNaN(dt.getTime()) ? 'N/A' : dt.toLocaleString('vi-VN');
            };

            setDevice({
              acceptedCards: typeof data.acceptedCards === 'string' ? data.acceptedCards : 'N/A',
              firmwareVersion: data.firmwareVersion || 'N/A',
              createAt: format(data.createAt),
              lastBootTime: format(data.lastBootTime),
              lastUpdateTime: format(data.lastUpdateTime),
              rfidModelType: data.rfidModelType || 'N/A',
              rssi: data.rssi ?? 0,
              startupInfo: data.startupInfo || 'N/A',
              temperatureCelsius: data.temperatureCelsius ?? 0,
              uptime: data.uptime || 'P0DT0H0M0S'
            });
          } else {
            message.error('Không tìm thấy thiết bị!');
          }
          setLoading(false);
        } catch (error) {
          console.error(error);
          message.error('Lỗi khi xử lý dữ liệu thiết bị!');
          setLoading(false);
        }
      },
      (error) => {
        console.error('Lỗi kết nối realtime:', error);
        message.error('Mất kết nối với server!');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [deviceId]);

  return (
    <RequestLayout profile={false}>
      {() => (
        <div className="page-request">
          <MenuAdd />
          <div className="page-content">
            <Spin spinning={loading} style={{ height: '100vh' }} tip="Loading..." size="large">
              {device && (
                <>
                  <Title level={2} className="title-request">
                    <ScanOutlined /> Thông tin thiết bị
                  </Title>
                  <Card 
                    bordered 
                    className="device-info-card" 
                    bodyStyle={{ padding: '24px' }}
                    extra={
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Text type="secondary">ID:</Text>
                            <Text strong>{deviceId}</Text>
                        </div>
                    }
                  >
                    <Descriptions
                      bordered
                      column={{ xxl: 3, xl: 3, lg: 2, md: 1, sm: 1, xs: 1 }}
                      layout="horizontal"
                      size="middle"
                      labelStyle={{
                        fontWeight: 600,
                        background: '#fafafa',
                        padding: '12px 16px',
                        width: '30%'
                      }}
                      contentStyle={{
                        padding: '12px 0px',
                        textAlign: 'center', 
                        alignItems: 'center',
                        minWidth: '130px' 
                      }}
                    >
                        
                        {/* Firmware */}
                        <Descriptions.Item label={<><CodeOutlined /> Firmware version</>} span={1}>
                            <Tag color="geekblue">{device.firmwareVersion}</Tag>
                        </Descriptions.Item>

                        {/* Nhiệt độ */}
                        <Descriptions.Item label={<><FireOutlined /> Nhiệt độ ESP</>} span={1}>
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center',
                            gap: 8 // Khoảng cách giữa text và icon
                        }}>
                            <Text
                            className={device.temperatureCelsius > 50 ? 'temperature-warning' : ''}
                            style={{ 
                                fontSize: 16,
                                textAlign: 'center',
                                margin: 0 // Loại bỏ margin mặc định
                            }}
                            >
                            {device.temperatureCelsius}°C
                            </Text>
                            {device.temperatureCelsius > 50 && (
                            <WarningOutlined style={{ 
                                color: '#ff4d4f',
                                alignSelf: 'center' // Đảm bảo icon căn giữa
                            }} />
                            )}
                        </div>
                        </Descriptions.Item>

                        {/* Uptime */}
                        <Descriptions.Item label={<><ClockCircleOutlined /> Đã hoạt động</>} span={1}>
                            <div className="uptime-display">
                                {parseISODuration(device.uptime as unknown as string)}
                            </div>
                        </Descriptions.Item>

                        {/* Model */}
                        <Descriptions.Item label={<><UsbOutlined /> Module RFID</>} span={1}>
                            <Text strong style={{ color: '#2d3436' }}>
                            {device.rfidModelType}
                            </Text>
                        </Descriptions.Item>

                        {/* RSSI */}
                        <Descriptions.Item label={<><WifiOutlined /> RSSI</>} span={1}>
                            <Tag
                            color={device.rssi < -80 ? 'error' : 'success'}
                            style={{ fontWeight: 500, minWidth: 80 }}
                            >
                            {device.rssi} dBm
                            </Tag>
                        </Descriptions.Item>

                        {/* Thẻ hỗ trợ */}
                        <Descriptions.Item label={<><IdcardOutlined /> Thẻ hỗ trợ</>} span={1}>
                            <Text ellipsis style={{ maxWidth: 200 }}>
                            {device.acceptedCards}
                            </Text>
                        </Descriptions.Item>

                        {/* Tạo lúc */}
                        <Descriptions.Item label={<><CalendarOutlined /> Thời gian khởi tạo</>} span={1}>
                            <Text type="secondary">{device.createAt}</Text>
                        </Descriptions.Item>

                        {/* Khởi động cuối */}
                        <Descriptions.Item label={<><PoweroffOutlined /> Khởi động gần nhất</>} span={1}>
                            <Text type="secondary">{device.lastBootTime}</Text>
                        </Descriptions.Item>

                        {/* Cập nhật cuối */}
                        <Descriptions.Item label={<><SyncOutlined /> Cập nhật lần cuối</>} span={1}>
                            <Text type="secondary">{device.lastUpdateTime}</Text>
                        </Descriptions.Item>

                        {/* Startup Info */}
                        <Descriptions.Item label={<><RocketOutlined /> Thông tin khởi động</>} span={2}>
                            <pre className="code-block">
                                {device.startupInfo}
                            </pre>
                        </Descriptions.Item>
                        
                    </Descriptions>
                  </Card>
                </>
              )}
            </Spin>
          </div>
        </div>
      )}
    </RequestLayout>
  );
};

export default DeviceInfoView;
