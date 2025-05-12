import { useEffect, useState } from 'react';
import { db } from '../../Firebase/FirebaseConfig';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import RequestLayout from '../RequestLayout';
import { List, Typography, Spin, Alert } from 'antd';
import '../AddRequest/AddRequest/addRequest.css'; // tái sử dụng CSS
import MenuAdd from '../DeviceInfoView/MenuDeviceInfoView/menuDeviceInfoView';

const { Text } = Typography;

interface Feedback {
  id: string;
  content: string;
  createdAt: string; // ISO string
}

function Reports() {
  const profile = false;
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'feedbacks'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const feedbackList = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            content: data.content,
            createdAt: data.createdAt || '',
          };
        });
        setFeedbacks(feedbackList);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching feedbacks:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const formatDate = (createdAt: string) => {
    if (!createdAt) return 'Không có thời gian';
    try {
      return new Date(createdAt).toLocaleString();
    } catch {
      return 'Không xác định';
    }
  };

  return (
    <RequestLayout profile={profile}>
      {() => (
        <div className="page-request">
          <MenuAdd />
          <h2 className="title-request sticky-title-request">BÁO CÁO GÓP Ý TỪ NGƯỜI DÙNG</h2>
          <div className="page-content-report">
            {loading ? (
              <Spin style={{ height: '100vh' }} tip="Loading..." size="large">
                <Alert
                  style={{ width: '100%', textAlign: 'center' }}
                  message="Loading..."
                  description="Vui lòng chờ trong giây lát. Đừng tải lại trang."
                  type="info"
                />
              </Spin>
            ) : (
              <div className="table-request">
                <div className="table-content">
                  <List
                    itemLayout="vertical"
                    dataSource={feedbacks}
                    renderItem={item => (
                      <List.Item
                        key={item.id}
                        style={{
                          background: '#fafafa',
                          marginBottom: 16,
                          padding: 16,
                          borderRadius: 8,
                          border: '1px solid #f0f0f0',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        <Text strong style={{ color: '#2F85EF' }}>
                          {formatDate(item.createdAt)}
                        </Text>
                        <br />
                        <Text>{item.content}</Text>
                      </List.Item>
                    )}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </RequestLayout>
  );
}

export default Reports;
