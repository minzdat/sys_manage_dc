// PetInfoModal.tsx
import { Modal, Descriptions, Card, Grid, Tag, Typography, Image, Button, Spin, message} from 'antd';
import { PetType, OwnerType } from './types';
import './index.css';
import { CalendarOutlined } from '@ant-design/icons';
import { useState, useEffect} from 'react';
import { db } from "../../Firebase/FirebaseConfig";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { doc, updateDoc } from "firebase/firestore";
import VaccinationHistoryModal from './VaccinationHistoryModal';
import { RequestType } from '../../Pages/ManageRequest/ManageRequest';

const { useBreakpoint } = Grid;
const { Text } = Typography;

interface PetInfoModalProps {
  visible: boolean;
  onCancel: () => void;
  pet: PetType;
  owner: OwnerType;
  onViewViolationDetail: (record: ViolationType) => void;
  setViolationModalVisible: (value: boolean) => void;
  setSelectedViolation: (violation: any) => void;
  violationModalVisible: boolean;
  onViewVaccinationDetail?: (vaccination: RequestType) => void;
  vaccinationModalVisible?: boolean;
  setVaccinationModalVisible?: (visible: boolean) => void;
  setSelectedVaccination?: (v: any) => void;
}

interface ViolationType {
  id: string;
  description: string;
  violationTime: string;
  status: string;
}

const PetInfoModal: React.FC<PetInfoModalProps> = ({
  visible,
  onCancel,
  pet,
  owner,
  onViewViolationDetail,
  setViolationModalVisible,
  setSelectedViolation,
  violationModalVisible, 
  onViewVaccinationDetail,
  setSelectedVaccination,
  setVaccinationModalVisible
}) => {
  const screens = useBreakpoint();
  const [violationPetModalVisible, setViolationPetModalVisible] = useState(false);
  const [violations, setViolations] = useState<ViolationType[]>([]);
  const [violationsLoading, setViolationsLoading] = useState(false);
  const [vaccinationModalOpen, setVaccinationModalOpen] = useState(false);
  const [currentVaccinationStatus, setCurrentVaccinationStatus] = useState(pet.vaccinationStatus);
  const [currentViolationStatus, setCurrentViolationStatus] = useState(pet.violationStatus); 
  
  const renderStatusTag = (status: string) => (
    <Tag color={status === 'Active' ? 'green' : 'orange'} style={{ borderRadius: '12px' }}>
      {status === 'Active' ? 'Đã hoàn thành' : 'Chưa giải quyết'}
    </Tag>
  );

  // PetInfoModal.tsx
  const renderGenderTag = (
      gender: string, 
      type: 'pet' | 'owner'
  ) => 
    {
      // Định nghĩa kiểu config với các key cụ thể
      type GenderConfig = {
      male: { color: string; text: string };
      female: { color: string; text: string };
      };
  
      // Sử dụng Record để xác định kiểu cho config
      const config: Record<'pet' | 'owner', GenderConfig> = {
      pet: {
          male: { color: '#1890ff', text: 'Đực' },
          female: { color: '#eb2f96', text: 'Cái' }
      },
      owner: {
          male: { color: '#096dd9', text: 'Nam' },
          female: { color: '#c41d7f', text: 'Nữ' }
      }
      };

      // Kiểm tra kiểu an toàn với type assertion
      const validGender = gender as keyof GenderConfig;
      const { color, text } = config[type][validGender] || { color: '#d9d9d9', text: 'N/A' };
  
      return (
      <Tag 
          color={color} 
          style={{ 
          borderRadius: '12px',
          textTransform: 'capitalize' 
          }}
      >
          {text}
      </Tag>
      );
  };

  const formatDate = (dateString: string) => {
    if (!dateString || dateString === 'N/A') return <Text type="secondary">N/A</Text>;
    
    try {
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? (
        <Text type="secondary">N/A</Text>
      ) : (
        <div className="date-container">
          <CalendarOutlined style={{ marginRight: 8 }} />
          <span>
            {date.toLocaleDateString('vi-VN', { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric' 
            })}
            <Text type="secondary" className="info-time">
              {date.toLocaleTimeString('vi-VN', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
          </span>
        </div>
      );
    } catch {
      return <Text type="secondary">N/A</Text>;
    }
  };

  const formatDateViolation = (dateString: string) => {
    if (!dateString || dateString === 'N/A') return <Text type="secondary">N/A</Text>;
  
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return <Text type="secondary">N/A</Text>;
  
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
    } catch {
      return <Text type="secondary">N/A</Text>;
    }
  };  

  const fetchViolations = async () => {
    if (!pet.id) return;
  
    setViolationsLoading(true);
    try {
      const q = query(
        collection(db, "violations"),
        where("petId", "==", pet.id)
      );
      
      const querySnapshot = await getDocs(q);
      const violationsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        violationTime: doc.data().violationTime,
        description: doc.data().description,
        status: doc.data().status
      })) as ViolationType[];
      
      setViolations(violationsData);
      checkAndUpdateViolationStatus(violationsData); 
    } catch (error) {
      console.error("Lỗi khi tải vi phạm:", error);
      message.error("Không thể tải danh sách vi phạm");
    } finally {
      setViolationsLoading(false);
    }
  };

  // Thêm hàm kiểm tra và cập nhật trạng thái vi phạm
  const checkAndUpdateViolationStatus = async (violations: ViolationType[]) => { 
    try {
      if (!pet.id) return;
      
      let newStatus = "Không vi phạm";
      const hasPending = violations.some(v => v.status === "Pending");
      
      if (hasPending) {
        newStatus = "Đang vi phạm";
      }

      // Chỉ cập nhật nếu trạng thái thay đổi
      if (currentViolationStatus !== newStatus) {
        await updateDoc(doc(db, 'pets', pet.id), {
          violationStatus: newStatus
        });
        setCurrentViolationStatus(newStatus);
      }
    } catch (error) {
      console.error("Lỗi khi cập nhật trạng thái vi phạm:", error);
      message.error("Cập nhật trạng thái vi phạm thất bại");
    }
  };

  const handleShowViolations = () => {
    setViolationPetModalVisible(true);
    fetchViolations();
  };

  // Thêm useEffect để lắng nghe real-time
  useEffect(() => { 
    let unsubscribe: () => void;

    if (visible && pet.id) {
      const violationsRef = collection(db, 'violations');
      unsubscribe = onSnapshot(violationsRef, () => {
        fetchViolations();
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [visible, pet.id]);

  // useEffect để cập nhật trạng thái tiêm phòng
  useEffect(() => {
    let unsubscribe: () => void;

    const checkAndUpdateVaccinationStatus = async (petId: string) => {
      try {
        const vaccinationsSnapshot = await getDocs(collection(db, 'vaccinations'));
        let hasEntries = false;
        let allActive = true;

        vaccinationsSnapshot.forEach((doc) => {
          const data = doc.data();
          if (Array.isArray(data.senderTo)) {
            data.senderTo.forEach((entry: any) => {
              const userIdParts = entry.userId?.split('|') || [];
              const entryPetId = userIdParts[userIdParts.length - 1];
              
              if (entryPetId === petId) {
                hasEntries = true;
                if (entry.status !== 'Active') {
                  allActive = false;
                }
              }
            });
          }
        });

        const newStatus = hasEntries 
          ? (allActive ? "Đã tiêm đủ" : "Chưa tiêm đủ")
          : "Chưa tiêm đủ";

        if (pet.vaccinationStatus !== newStatus) {
          await updateDoc(doc(db, 'pets', petId), {
            vaccinationStatus: newStatus
          });
          setCurrentVaccinationStatus(newStatus);
        }
      } catch (error) {
        console.error("Lỗi khi kiểm tra lịch sử tiêm phòng:", error);
      }
    };

    if (visible && pet.id) {
      // Kiểm tra ngay khi mở modal và lắng nghe real-time
      checkAndUpdateVaccinationStatus(pet.id);
      unsubscribe = onSnapshot(collection(db, 'vaccinations'), () => {
        checkAndUpdateVaccinationStatus(pet.id);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [visible, pet.id, pet.vaccinationStatus]);

  // Cập nhật state local khi prop thay đổi
  useEffect(() => {
    setCurrentVaccinationStatus(pet.vaccinationStatus);
  }, [pet.vaccinationStatus]);

  return (
    <Modal
      style={{
        top: 30,
        maxWidth: '100vw'
      }}
      styles={{
        body: { 
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '75vh',
          overflowY: 'auto',
        },
        content: {
          maxWidth: '95vw',
          // top: 50,
        }
      }}
      className="pet-info-modal"
      title={
        <div className="modal-title">
          {/* <HeartFilled style={{ color: '#ff4d4f', fontSize: '1.8rem' }} /> */}
          <span>Thông tin định danh thú cưng</span>
        </div>
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={screens.md ? 860 : '90%'}
      centered
      destroyOnClose
    >
      {/* Pet Information */}
      <Card 
        className="pet-info-card pet-card"
        style={{ flexShrink: 0 }}
        title="Thông tin thú cưng"
        cover={pet.imageUrl && <Image 
          src={pet.imageUrl} 
          alt="pet-image"
          height={200}
          preview={false}
          style={{ objectFit: 'cover' }}
        />}
      >
        <Descriptions 
          column={screens.md ? 2 : 1}
          size="middle"
          labelStyle={{ fontWeight: 600 }}
          contentStyle={{ fontWeight: 500 }}
        >
          <Descriptions.Item label="Tên" span={2}>
            <Text strong className="info-value">{pet.name || 'N/A'}</Text>
          </Descriptions.Item>

          <Descriptions.Item label={<>Loài</>}>{pet.species}</Descriptions.Item>
          <Descriptions.Item label="Giống">{pet.breed}</Descriptions.Item>

          <Descriptions.Item label="Tuổi">{pet.age} năm</Descriptions.Item>
          <Descriptions.Item label="Giới tính">
            {renderGenderTag(pet.gender, 'pet')}
          </Descriptions.Item>

          <Descriptions.Item
            label={
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span>Sức khỏe</span>
                <Button 
                    type="link" 
                    size="small" 
                    style={{ padding: 0, marginTop: 2 }}
                >
                    Xem thêm
                </Button>
              </div>
            }
          >
            <div className="health-status">
              <div>
                <div>{pet.healthStatus}</div>
                {pet.lastCheckHealthDate && (
                    <div className="last-check">
                    {formatDate(pet.lastCheckHealthDate)}
                    </div>
                )}
              </div>
            </div>
          </Descriptions.Item>

          <Descriptions.Item
            label={
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span>Vi phạm</span>
                <Button type="link" size="small" style={{ padding: 0, marginTop: 2 }} onClick={handleShowViolations}>
                    Xem thêm
                </Button>
                <Modal
                  title={`Lịch sử vi phạm của ${pet.name}`}
                  open={violationPetModalVisible}
                  onCancel={() => setViolationPetModalVisible(false)}
                  footer={null}
                  width={screens.xs ? '95vw' : 900}
                  style={{
                    top: 30,
                    maxWidth: '100vw',
                  }}
                  styles={{
                    body: {
                      maxHeight: '70vh',
                      overflowY: 'auto',
                      padding: screens.xs ? '8px 12px' : '12px 16px',
                    },
                  }}
                >
                  <Spin spinning={violationsLoading}>
                    {violations.length > 0 ? (
                      <Descriptions
                        bordered
                        column={1}
                        size={screens.xs ? 'small' : 'middle'}
                        labelStyle={{ width: screens.xs ? 100 : 200 }}
                      >
                        {violations.map((violation) => (
                          <Descriptions.Item
                            key={violation.id}
                            label={formatDateViolation(violation.violationTime)}
                          >
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: screens.md ? 'row' : 'column',
                                gap: 12,
                                cursor: 'pointer',
                              }}
                              onClick={() => {
                                setViolationPetModalVisible(false);
                                setTimeout(() => {
                                  onViewViolationDetail(violation); 
                                }, 0);
                              }}                              
                            >
                              <div style={{ flex: 2 }}>
                                <Text strong>Mã vi phạm:</Text>
                                <div style={{ marginTop: 4 }}>{violation.id}</div>
                              </div>
                              <div style={{ flex: 2 }}>
                                <Text strong>Mô tả:</Text>
                                <div style={{ marginTop: 4 }}>
                                  {violation.description || 'Không có mô tả'}
                                </div>
                              </div>
                              <div style={{ flex: 1 }}>
                                <Text strong>Trạng thái:</Text>
                                <div style={{ marginTop: 4 }}>
                                  {renderStatusTag(violation.status)}
                                </div>
                              </div>
                            </div>
                          </Descriptions.Item>
                        ))}
                      </Descriptions>
                    ) : (
                      <div style={{ textAlign: 'center', padding: 20 }}>
                        <Text type="secondary">Không có vi phạm nào</Text>
                      </div>
                    )}
                  </Spin>
                </Modal>
              </div>
            }
          >
            <div className={currentViolationStatus === 'Đang vi phạm' ? 'violation-info' : 'no-violation'}> 
              {currentViolationStatus || "Không có thông tin"} 
              {pet.lastViolationDate && (
                <div className="violation-date">
                  {formatDate(pet.lastViolationDate)}
                </div>
              )}
            </div>
          </Descriptions.Item>

          <Descriptions.Item 
            label={
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>Tiêm phòng</span>
                  <Button type="link" size="small" style={{ padding: 0, marginTop: 2 }} onClick={() => setVaccinationModalOpen(true)}>
                    Xem thêm
                  </Button>
                  <VaccinationHistoryModal
                    open={vaccinationModalOpen}
                    onCancel={() => setVaccinationModalOpen(false)}
                    petId={pet.id}
                    petName={pet.name}
                    onViewVaccinationDetail={onViewVaccinationDetail}
                    setSelectedVaccination={setSelectedVaccination}
                    setVaccinationModalVisible={setVaccinationModalVisible}
                  />
                </div>
              }
            >
            <Tag 
              color={currentVaccinationStatus === 'Đã tiêm đủ' ? '#52c41a' : '#ffa940'}
              className="vaccine-tag"
            >
              {currentVaccinationStatus}
            </Tag>
          </Descriptions.Item>

          <Descriptions.Item label="Lần tiêm cuối">
            {formatDate(pet.lastVaccineDate)}
          </Descriptions.Item>

        </Descriptions>
      </Card>

      {/* Owner Information */}
      <Card 
        className="pet-info-card owner-card"
        style={{ marginTop: 24 }}
        title="Thông tin chủ nuôi" 
      >
        <Descriptions 
          column={screens.md ? 2 : 1}
          size="middle"
          labelStyle={{ fontWeight: 600 }}
        >
          <Descriptions.Item label={<>Họ tên</>} span={2}>
            <Text strong>{owner.fullName || 'N/A'}</Text>
          </Descriptions.Item>

          <Descriptions.Item label={<>Số điện thoại</>}>{owner.phone}</Descriptions.Item>
          <Descriptions.Item label={<>Email</>}>{owner.email}</Descriptions.Item>

          <Descriptions.Item label="Số căn cước">{owner.cccd}</Descriptions.Item>
          
          <Descriptions.Item label="Giới tính">
            {renderGenderTag(owner.sex ? 'male' : 'female', 'owner')}
          </Descriptions.Item>

          <Descriptions.Item label="Ngày sinh">
            {formatDate(owner.birthday)}
          </Descriptions.Item>
          
          <Descriptions.Item label={<>Địa chỉ</>} span={2}>
            <div className="address-info">
              {owner.address}
            </div>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Last Update Section */}
      <div className="last-update">
        <Text type="secondary">
          Cập nhật lần cuối: {formatDate(pet.lastUpdateTime)}
        </Text>
        <div style={{ marginTop: 8 }}>
          <Text type="secondary">Thực hiện bởi: {pet.lastModifiedBy}</Text>
        </div>
      </div>
    </Modal>
  );
};

export default PetInfoModal;