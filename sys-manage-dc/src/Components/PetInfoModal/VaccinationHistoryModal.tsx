import React, { useEffect, useState } from 'react';
import { Modal, Descriptions, Typography, Spin, Grid, Tag } from 'antd';
import { CalendarOutlined } from '@ant-design/icons';
import { collection, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../Firebase/FirebaseConfig';

const { Text } = Typography;
const { useBreakpoint } = Grid;

interface Props {
  petId: string;
  petName: string;
  open: boolean;
  onCancel: () => void;
  onViewVaccinationDetail?: (record: any) => void;
  setSelectedVaccination?: (v: any) => void;
  setVaccinationModalVisible?: (v: boolean) => void;
}

interface VaccinationItem {
  id: string;
  createdAt: Date;
  vaccineType: string;
  userId: string;
  status: 'Pending' | 'Active';
}

const VaccinationHistoryModal: React.FC<Props> = ({
  petId,
  petName,
  open,
  onCancel,
  onViewVaccinationDetail // THÊM VÀO ĐÂY
}) => {
  const [vaccines, setVaccines] = useState<VaccinationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const screens = useBreakpoint();

  const formatDate = (date: Date): React.ReactNode => {
    if (!date || isNaN(date.getTime())) {
      return <Text type="secondary">N/A</Text>;
    }

    const datePart = date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

    const timePart = date.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span>
          <CalendarOutlined style={{ marginRight: 6 }} />
          <strong>{datePart}</strong>
        </span>
        <Text type="secondary" style={{ marginLeft: 24 }}>{timePart}</Text>
      </div>
    );
  };

  useEffect(() => {
    let unsubscribe: () => void;

    const fetchVaccinations = () => {
      try {
        setLoading(true);
        unsubscribe = onSnapshot(collection(db, 'vaccinations'), (snapshot) => {
          const items: VaccinationItem[] = [];

          snapshot.forEach((doc) => {
            const data = doc.data();
            const createdAtRaw = data.createdAt;
            const createdAt = 
              createdAtRaw instanceof Timestamp 
                ? createdAtRaw.toDate()
                : new Date(createdAtRaw);

            if (Array.isArray(data.senderTo)) {
              data.senderTo.forEach((entry: any) => {
                const userIdParts = entry.userId?.split('|') || [];
                const entryPetId = userIdParts[userIdParts.length - 1];
                
                if (entryPetId === petId) {
                  items.push({
                    id: doc.id,
                    createdAt,
                    userId: entry.userId,
                    vaccineType: data.vaccineType || 'Không rõ',
                    status: entry.status || 'Pending',
                  });
                }
              });
            }
          });

          setVaccines(items);
          setLoading(false);
        });
      } catch (error) {
        console.error('Lỗi khi tải lịch sử tiêm phòng:', error);
        setLoading(false);
      }
    };

    if (open) fetchVaccinations();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [open, petId]);

  const renderStatus = (status: string) => (
    <Tag color={status === 'Active' ? 'green' : 'orange'} style={{ borderRadius: '12px' }}>
      {status === 'Active' ? 'Đã hoàn thành' : 'Chưa giải quyết'}
    </Tag>
  );

  return (
    <Modal
      title={`Lịch sử tiêm phòng của ${petName}`}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={screens.xs ? '95vw' : 1200}
      style={{ top: 30, maxWidth: '100vw' }}
      styles={{
        body: {
          maxHeight: '70vh',
          overflowY: 'auto',
          padding: screens.xs ? '8px 12px' : '12px 16px',
        },
      }}
    >
      <Spin spinning={loading}>
        {vaccines.length > 0 ? (
          <Descriptions
            bordered
            column={1}
            size={screens.xs ? 'small' : 'middle'}
            labelStyle={{ width: screens.xs ? 100 : 200 }}
          >
            {vaccines.map((vaccine) => (
              <Descriptions.Item
                key={`${vaccine.id}-${vaccine.userId}`}
                label={formatDate(vaccine.createdAt)}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: screens.md ? 'row' : 'column',
                    flexWrap: 'wrap',
                    gap: 12,
                    cursor: 'pointer'
                  }}
                  onClick={() => {
                    if (onViewVaccinationDetail) {
                      onViewVaccinationDetail({
                        id: `${vaccine.id}_${vaccine.userId}`,
                        type: 'Thông tin tiêm phòng',
                        status: vaccine.status,
                        requestCode: '',
                        createdBy: '',
                        createdAt: '',
                        lastModifiedBy: '',
                        lastUpdateTime: ''
                      });
                    }
                    if (onCancel) {
                      onCancel(); 
                    }
                  }}                             
                >
                  <div style={{ flex: 2 }}>
                    <Text strong>Mã tiêm phòng:</Text>
                    <div>{vaccine.id}</div>
                  </div>
                  <div style={{ flex: 2 }}>
                    <Text strong>Loại vắc-xin:</Text>
                    <div>{vaccine.vaccineType}</div>
                  </div>
                  <div style={{ flex: 2 }}>
                    <Text strong>Người nhận:</Text>
                    <div>{vaccine.userId}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Text strong>Trạng thái:</Text>
                    <div>{renderStatus(vaccine.status)}</div>
                  </div>
                </div>
              </Descriptions.Item>
            ))}
          </Descriptions>
        ) : (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Text type="secondary">Không có lịch sử tiêm phòng</Text>
          </div>
        )}
      </Spin>
    </Modal>
  );
};

export default VaccinationHistoryModal;