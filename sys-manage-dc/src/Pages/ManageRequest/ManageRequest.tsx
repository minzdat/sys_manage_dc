import { useState, useEffect } from 'react'
import "./index.css";
import { Spin, Button, Input, Space, Table, message, Modal, Select, InputNumber, Tag, Tooltip} from 'antd';
import { TagOutlined, ExperimentOutlined, PhoneOutlined, HomeOutlined, PlusOutlined, ArrowRightOutlined, FileTextOutlined, CheckCircleOutlined, UserOutlined, CalendarOutlined, ClockCircleOutlined, EnvironmentOutlined, PictureOutlined} from '@ant-design/icons';
import RequestLayout from '../../Components/RequestLayout';
import { useNavigate } from "react-router-dom";
import { connect } from 'react-redux';
import { setTab, setStatus } from '../../Actions/requestAction';
import { RootState } from '../../Reducers/rootReducer';
import { Form } from 'antd';
import { db } from "../../Firebase/FirebaseConfig"; 
import { getDocs, getDoc, collection, query, where, onSnapshot, doc, updateDoc, DocumentData} from "firebase/firestore";
import PetInfoModal from '../../Components/PetInfoModal/PetInfoModal';
import {PetType, OwnerType} from '../../Components/PetInfoModal/types';
import { Descriptions, Image } from 'antd';
import { UserInfo } from '../../Reducers/requestReducer';

export interface RequestType {
  id: string;
  requestCode: string;
  status: string;
  createdBy: string;
  createdAt: string;
  lastModifiedBy: string;
  lastUpdateTime: string;
  type: string; 
  description?: string;
  notes?: string;
  violationLocation?: string;
  violationTime?: any;
  attachments?: string[]; 
}

interface ManageRequestProps {
  tab: string | null;
  status: string | null;
  userInfo: UserInfo;
  setTab: (tab: string) => void;
  setStatus: (status: string) => void; 
}

const statusMapping = {
  'Writing': 'Đang ghi thẻ',
  'Processing': 'Đang xử lý',
  'Active': 'Đã hoàn thành',
  'Pending': 'Chưa giải quyết'
} as const;

type StatusKey = keyof typeof statusMapping;
type StatusValue = typeof statusMapping[StatusKey];

const { Search } = Input;

const ManageRequest: React.FC<ManageRequestProps> = (props) => {

  const [requestData, setRequestData] = useState<RequestType[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [form] = Form.useForm();
  const [filteredData, setFilteredData] = useState<RequestType[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestType | null>(null);

  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [selectedPet, setSelectedPet] = useState<PetType | null>(null);
  const [selectedOwner, setSelectedOwner] = useState<OwnerType | null>(null);
  const [petRequests, setPetRequests] = useState<RequestType[]>([]);
  const [deviceRequests, setDeviceRequests] = useState<RequestType[]>([]);
  const [violationRequests, setViolationRequests] = useState<RequestType[]>([]); 
  const [vaccinationRequests, setVaccinationRequests] = useState<RequestType[]>([]);
  const [violationModalVisible, setViolationModalVisible] = useState(false);
  const [selectedViolation, setSelectedViolation] = useState<any>(null);
  const [selectedPetInViolation, setSelectedPetInViolation] = useState<PetType | null>(null);
  const [selectedOwnerInViolation, setSelectedOwnerInViolation] = useState<OwnerType | null>(null);
  const [vaccinationModalVisible, setVaccinationModalVisible] = useState(false);
  const [selectedVaccination, setSelectedVaccination] = useState<any>(null);
  const [selectedPets, setSelectedPets] = useState<PetType[]>([]);
  const [selectedOwnerVaccination, setSelectedOwnerVaccination] = useState<OwnerType | null>(null);
  const [selectedPetInVaccination, setSelectedPetInVaccination] = useState<PetType | null>(null);
  const [selectedOwnerInVaccination, setSelectedOwnerInVaccination] = useState<OwnerType | null>(null);

  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });

  // Thêm vào phần khai báo state
  const defaultOwner: OwnerType = {
    id: '',
    address: 'N/A',
    birthday: 'N/A',
    cccd: 'N/A',
    email: 'N/A',
    fullName: 'N/A',
    phone: 'N/A',
    sex: 'N/A',
    updateAt: 'N/A'
  };

  const handleVaccinationClick = async (record: RequestType) => {
    try {
      setLoading(true);
      const [vaccinationId, ...rest] = record.id.split('_');
      const userId = rest.join('_'); // Ghép lại toàn bộ phần còn lại
      const vaccinationDoc = await getDoc(doc(db, "vaccinations", vaccinationId));
      
      if (vaccinationDoc.exists()) {
        const vaccinationData = vaccinationDoc.data();
        const statusDisplay = vaccinationData.status === "Pending" 
          ? "Chưa giải quyết" 
          : "Đã hoàn thành";
        
        // Tìm user cụ thể trong senderTo
        const userEntry = (vaccinationData.senderTo || []).find(
          (u: any) => u.userId === userId
        );        
  
        const vaccinationWithId = {
          ...vaccinationData,
          id: vaccinationDoc.id,
          userId, 
          status: userEntry?.status || statusDisplay, 
          ...(statusDisplay === "Đã hoàn thành" && {
            resolvedAt: userEntry?.resolvedAt || 'N/A',
            resolvedBy: userEntry?.resolvedBy || 'N/A'
          }),
          createdAt: formatDate(vaccinationData.createdAt),
          timeFrom: formatDate(vaccinationData.timeFrom),
          timeTo: formatDate(vaccinationData.timeTo),
          vaccineLocation: vaccinationData.vaccineLocation,
          issuingAuthority: vaccinationData.issuingAuthority,
          cost: vaccinationData.cost,
          notes: vaccinationData.notes,
          vaccineType: vaccinationData.vaccineType || "N/A",
          senderTo: [userEntry] 
        };
  
        // Tách ownerId và petId từ userId
        const [ownerId, petId] = userId.split('|');

        // Lấy danh sách thú cưng theo ownerId
        if (ownerId) {
          const petQuery = query(
            collection(db, "pets"),
            where("ownerId", "==", ownerId)
          );
          const petSnapshot = await getDocs(petQuery);
          const pets = petSnapshot.docs.map((doc: DocumentData) => ({
            id: doc.id,
            ...doc.data()
          }) as PetType);
          setSelectedPets(pets);
        }

        // Lấy thông tin chi tiết thú cưng theo petId
        if (petId) {
          const petDoc = await getDoc(doc(db, "pets", petId));
          if (petDoc.exists()) {
            const petData = { id: petDoc.id, ...petDoc.data() } as PetType;
            setSelectedPetInVaccination(petData);
          } else {
            setSelectedPetInVaccination(null);
          }
        } else {
          setSelectedPetInVaccination(null);
        }

        // Lấy thông tin chủ nuôi theo ownerId
        if (ownerId) {
          const ownerDoc = await getDoc(doc(db, "owners", ownerId));
          if (ownerDoc.exists()) {
            setSelectedOwnerInVaccination(ownerDoc.data() as OwnerType);
          } else {
            setSelectedOwnerInVaccination(null);
          }
        } else {
          setSelectedOwnerInVaccination(null);
        }

        setSelectedVaccination(vaccinationWithId);
        setVaccinationModalVisible(true);
      }
    } catch (error) {
      message.error("Lỗi khi tải thông tin tiêm phòng");
    } finally {
      setLoading(false);
    }
  };

  const handleViolationClick = async (record: RequestType) => {
    try {
      setLoading(true);
      const violationDoc = await getDoc(doc(db, "violations", record.id));
      
      if (violationDoc.exists()) {
        const violationData = violationDoc.data();
        const statusDisplay = violationData.status === "Pending" 
        ? "Chưa giải quyết" 
        : "Đã hoàn thành";
        const violationWithId = {
          ...violationData,
          id: violationDoc.id,
          status: statusDisplay,
          createdAt: formatDate(violationData.createdAt),
          violationTime: formatDate(violationData.violationTime),
          attachments: violationData.attachments || [],
        };

        // Fetch thông tin thú cưng
        if (violationData.petId) {
          const petDoc = await getDoc(doc(db, "pets", violationData.petId));
          if (petDoc.exists()) {
            const petData = { id: petDoc.id, ...petDoc.data() } as PetType;
            setSelectedPetInViolation(petData);
            
            // Fetch thông tin chủ nuôi
            if (petData.ownerId) {
              const ownerDoc = await getDoc(doc(db, "owners", petData.ownerId));
              if (ownerDoc.exists()) {
                setSelectedOwnerInViolation(ownerDoc.data() as OwnerType);
              }
            }
          }
        }

        setSelectedViolation(violationWithId);
        setViolationModalVisible(true);
      }
    } catch (error) {
      message.error("Lỗi khi tải thông tin vi phạm");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination(prev => ({
      ...prev,
      current: page,
      pageSize: pageSize,
    }));
  };

  useEffect(() => {
    const violationsQuery = query(
      collection(db, "violations")
    );

    const unsubscribeViolations = onSnapshot(violationsQuery, (querySnapshot) => {
      const violationsData: RequestType[] = [];
      querySnapshot.forEach((doc) => {
        const violationData = doc.data();

        let statusDisplay, lastModifiedBy, lastUpdateTime;
        if (violationData.status === "Pending") {
          statusDisplay = "Chưa giải quyết";
          lastModifiedBy = violationData.handlerBy || 'N/A';
          lastUpdateTime = violationData.updatedAt;
        } else if (violationData.status === "Active") {
          statusDisplay = "Đã hoàn thành";
          lastModifiedBy = violationData.resolvedBy || 'N/A';
          lastUpdateTime = violationData.resolvedAt;
        } else return;
        
        violationsData.push({
          id: doc.id,
          type: "Thông tin vi phạm",
          requestCode: doc.id,
          status: statusDisplay,
          createdBy: violationData.notificationBy || 'N/A',
          createdAt: formatDate(violationData.createdAt),
          lastModifiedBy: lastModifiedBy,
          lastUpdateTime: formatDate(lastUpdateTime),
          description: violationData.description,
          notes: violationData.notes,
          violationLocation: violationData.violationLocation,
          violationTime: violationData.violationTime,
          attachments: violationData.attachments || [],
        });
      });
      setViolationRequests(violationsData);
    }, (error) => {
      message.error("Lỗi khi tải dữ liệu vi phạm: " + error.message);
    });

    return () => unsubscribeViolations();
  }, []);

  useEffect(() => {
    const vaccinationsQuery = query(
      collection(db, "vaccinations")
    );
  
    const unsubscribeVaccinations = onSnapshot(vaccinationsQuery, (querySnapshot) => {
      const vaccinationsData: RequestType[] = [];
      querySnapshot.forEach((vaccinationDoc) => {
        const vaccinationData = vaccinationDoc.data();
        const senderTo = vaccinationData.senderTo || [];
  
        // Xử lý từng user trong senderTo
        senderTo.forEach((user: any) => {
          const statusDisplay = user.status === "Pending" 
            ? "Chưa giải quyết" 
            : "Đã hoàn thành";
  
          vaccinationsData.push({
            id: `${vaccinationDoc.id}_${user.userId}`,
            type: "Thông tin tiêm phòng",
            requestCode: `${vaccinationDoc.id} | ${user.userId || 'N/A'}`,
            status: statusDisplay,
            createdBy: vaccinationData.notificationBy || 'N/A',
            createdAt: formatDate(vaccinationData.createdAt) || 'N/A', 
            lastModifiedBy: user.resolvedBy || '',                      
            lastUpdateTime: formatDate(user.resolvedAt) || '',         
          });
        });
      });
      setVaccinationRequests(vaccinationsData);
    }, (error) => {
      message.error("Lỗi khi tải dữ liệu tiêm phòng: " + error.message);
    });
  
    return () => unsubscribeVaccinations();
  }, []);

  useEffect(() => { 
    // Xử lý pets
    const petsQuery = query(
      collection(db, "pets"),
      where("status", "in", ["Processing", "Active", "Writing"])
    );
  
    const unsubscribePets = onSnapshot(petsQuery, (querySnapshot) => {
      const petsData: RequestType[] = [];
      querySnapshot.forEach((doc) => {
        const petData = doc.data();
        
        petsData.push({
          id: doc.id,
          type: "Định danh chó(mèo)", // Thêm trường type
          requestCode: doc.id,
          status: petData.status === "Active" 
            ? "Đã hoàn thành" 
            : petData.status === "Writing" 
            ? "Đang ghi thẻ" 
            : "Đang xử lý",
          createdBy: petData.rfidReaderId || 'N/A',
          createdAt: formatDate(petData.createdAt),
          lastModifiedBy: petData.lastModifiedBy || 'N/A',
          lastUpdateTime: formatDate(petData.lastUpdateTime)
        });
      });
      setPetRequests(petsData);
      setLoading(false);
    }, (error) => {
      message.error("Lỗi khi tải dữ liệu thú cưng: " + error.message);
      setLoading(false);
    });
  
    // Xử lý thiết bị
    const devicesQuery = query(collection(db, "rfidReaderDevices"));
    
    const unsubscribeDevices = onSnapshot(devicesQuery, (querySnapshot) => {
      const devicesData: RequestType[] = [];
      querySnapshot.forEach((doc) => {
        const deviceData = doc.data();
        
        const createdAt = deviceData.createAt || deviceData.createdAt; 

        // Thêm logic chuyển đổi status
        const deviceStatus = deviceData.status === "Active" ? "Đã hoàn thành" : "Đang xử lý"; // Mặc định cho các trạng thái khác

        devicesData.push({
          id: doc.id,
          type: "Thông tin thiết bị", // Thêm trường type
          requestCode: doc.id,
          status: deviceStatus,
          createdBy: doc.id, // Sử dụng ID document làm người tạo
          createdAt: formatDate(createdAt),
          lastModifiedBy: '', // Thiết bị không có người thực hiện
          lastUpdateTime: '' // Thiết bị không có ngày thực hiện
        });
      });
      setDeviceRequests(devicesData);
    }, (error) => {
      message.error("Lỗi khi tải dữ liệu thiết bị: " + error.message);
    });
  
    return () => {
      unsubscribePets();
      unsubscribeDevices();
    };
  }, []);

  useEffect(() => {
    // Hàm chuyển đổi chuỗi ngày tháng thành Date object
    const parseDate = (dateStr: string) => {
      if (dateStr === 'N/A') return new Date(0);
      const [day, month, year] = dateStr.split('/');
      return new Date(`${year}-${month}-${day}`);
    };

    // Hàm lọc kết hợp cả tab và status
    const filterData = (data: RequestType[]) => {
      let filtered = data;
    
      // Lọc theo tab
      switch (props.tab) {
        case 'get-devices':
          filtered = filtered.filter(item => item.type === "Thông tin thiết bị");
          break;
        case 'get-pets':
          filtered = filtered.filter(item => item.type === "Định danh chó(mèo)");
          break;
        case 'get-violations':
          filtered = filtered.filter(item => item.type === "Thông tin vi phạm");
          break;
        case 'get-vaccines':
          filtered = filtered.filter(item => item.type === "Thông tin tiêm phòng");
          break;
      }
    
      // Lọc theo status với type safety
      if (props.status) {
        const statusKey = props.status as StatusKey;
        if (statusMapping[statusKey]) {
          filtered = filtered.filter(item => item.status === statusMapping[statusKey]);
        }
      }
    
      return filtered;
    };

    const combinedData = [...petRequests, ...deviceRequests, ...violationRequests, ...vaccinationRequests]
      .sort((a, b) => {
        const dateA = parseDate(a.createdAt);
        const dateB = parseDate(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

    const finalData = filterData(combinedData);

    setRequestData(finalData);
    setFilteredData(finalData);
    setPagination(prev => ({
      ...prev,
      total: finalData.length,
    }));
  }, [petRequests, deviceRequests, violationRequests, vaccinationRequests, props.tab, props.status]);
  
  // Hàm xử lý ngày tháng cải tiến
  const formatDate = (date: any) => {
    try {
      // Xử lý cả Timestamp object và string
      const dateObj = date?.toDate?.() || new Date(date);
      return isNaN(dateObj.getTime()) 
        ? 'N/A' 
        : dateObj.toLocaleDateString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
          });
    } catch (error) {
      return 'N/A';
    }
  };

  const columns = [
    {
      title: 'Loại yêu cầu',
      dataIndex: 'type', // Thay đổi từ render cố định
      key: 'type',
    },
    {
      title: 'Mã yêu cầu',
      dataIndex: 'requestCode',
      key: 'requestCode',
      render: (text: string) => (
        <Tooltip
          title={
            <div 
              style={{ 
                whiteSpace: 'pre-line',    // Cho phép xuống dòng
                textAlign: 'center',       // Căn giữa nội dung
                wordBreak: 'break-word',   // Xử lý tràn chữ
                lineHeight: '1.5',         // Giãn cách dòng
              }}
            >
              {text.replace(/\|/g, '\n')}  {/* Thay thế | thành xuống dòng */}
            </div>
          }
          overlayStyle={{ 
            maxWidth: '300px',            // Giới hạn chiều rộng tối đa
          }}
        >
          <span 
            style={{ cursor: 'help' }} 
            onClick={(e) => e.stopPropagation()}
          >
            {text.split('|')[0]}          {/* Hiển thị phần trước dấu | */}
          </span>
        </Tooltip>
      )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: RequestType) => {
        let color = '#1890ff';
        
        if (record.type === 'Định danh chó(mèo)') {
          // Logic cho thú cưng
          if (status === 'Đang ghi thẻ') color = '#ffa500';
          else if (status === 'Đang xử lý') color = '#ffd700';
          else if (status === 'Đã hoàn thành') color = '#52c41a';
        } 
        else if (record.type === 'Thông tin vi phạm') {
          color = status === 'Chưa giải quyết' ? '#ff4d4f' : '#52c41a'; 
          status = status === 'Chưa giải quyết' ? 'Chưa giải quyết' : 'Đã hoàn thành';
        }
        else if (record.type === 'Thông tin tiêm phòng') {
          color = status === 'Chưa giải quyết' ? '#ff4d4f' : '#52c41a';
        }
        else {
          // Logic mới cho thiết bị
          color = status === 'Đã hoàn thành' ? '#52c41a' : '#ff4d4f';
        }
        
        return <span style={{ color, fontWeight: 500 }}>{status}</span>;
      }
    },
    {
      title: 'Người tạo',
      dataIndex: 'createdBy',
      key: 'createdBy',
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: (a: RequestType, b: RequestType) => {
        const parseDate = (dateStr: string) => {
          if (dateStr === 'N/A') return new Date(0);
          const [day, month, year] = dateStr.split('/');
          return new Date(`${year}-${month}-${day}`);
        };
        return parseDate(a.createdAt).getTime() - parseDate(b.createdAt).getTime();
      },
    },
    {
      title: 'Người thực hiện',
      dataIndex: 'lastModifiedBy',
      key: 'executor',
      render: (text: string, record: RequestType) => {
        const { type, status } = record;
        if (
          (type === 'Thông tin vi phạm' || type === 'Thông tin tiêm phòng') &&
          status === 'Đã hoàn thành'
        ) {
          return text || 'N/A';
        }
        if (type === 'Định danh chó(mèo)' && status !== 'Đang xử lý') {
          return text || 'N/A';
        }
        return '';
      }
    },
    {
      title: 'Ngày thực hiện',
      dataIndex: 'lastUpdateTime',
      key: 'executionDate',
      render: (text: string, record: RequestType) => {
        const { type, status } = record;
        if (
          (type === 'Thông tin vi phạm' || type === 'Thông tin tiêm phòng') &&
          status === 'Đã hoàn thành'
        ) {
          return text || 'N/A';
        }
        if (type === 'Định danh chó(mèo)' && status !== 'Đang xử lý') {
          return text || 'N/A';
        }
        return '';
      }
    }    
  ];

  useEffect(() => {
    const lowerQuery = searchQuery.toLowerCase();
    const filtered = requestData.filter(request => {
      const safeString = (str?: string) => (str || '').toLowerCase();
      
      return [
        safeString(request.requestCode),
        safeString(request.createdBy),
        safeString(request.createdAt),
        safeString(request.type)
      ].some(field => field.includes(lowerQuery));
    });
    
    setFilteredData(filtered);
  }, [searchQuery, requestData]);
  
  const profile = false;

  const handleOk = async () => {
    try {
      // 1. Validate form và lấy giá trị
      const values = await form.validateFields();
      
      const ageValue = Number(values.age) || 0; // Fallback về 0 nếu không hợp lệ
      const roundedAge = Math.round(ageValue * 10) / 10; // Làm tròn 1 số thập phân

      if (!selectedRequest) {
        message.error("Không tìm thấy thú cưng!");
        return;
      }

      // Hàm tạo timestamp theo định dạng local (không UTC)
      const getLocalTimestamp = () => {
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      };

      // Lấy thông tin người dùng từ localStorage
      const userEmail = localStorage.getItem('email') || 'Unknown';

      // Tạo timestamp
      const currentTime = getLocalTimestamp(); // Sử dụng hàm mới
      
      // Object chứa các trường thời gian
      const timeFields = {
        lastUpdateTime: currentTime,
        lastModifiedBy: userEmail,
        ...(values.healthStatus && { 
          lastCheckHealthDate: currentTime 
        }),
        ...(values.vaccinationStatus && { 
          lastVaccineDate: currentTime 
        }),
        ...(values.violationStatus && { 
          lastViolationDate: currentTime 
        })
      };

      // 2. Chuẩn bị dữ liệu cho Firestore
      const petData = {
        ...values,
        ...timeFields,
        age: roundedAge, 
        name: values.name,
        species: values.species,
        breed: values.breed,
        gender: values.gender,
        
        // Thông tin sức khỏe
        healthStatus: values.healthStatus,
        vaccinationStatus: values.vaccinationStatus,
        
        // Thông tin chủ sở hữu
        ownerId: values.ownerId,
        
        // Metadata
        status: "Writing", // Cập nhật trạng thái
      
      };

      // 3. Cập nhật vào Firestore
      const petRef = doc(db, "pets", selectedRequest.id);
      await updateDoc(petRef, petData);
      
      // 4. Thông báo và đóng modal
      message.success("Cập nhật thông tin thành công!");
      setIsModalVisible(false);
      form.resetFields();

    } catch (error) {
      console.error("Lỗi khi cập nhật:", error);
      message.error("Cập nhật thất bại! Vui lòng kiểm tra lại thông tin.");
    }
  };
  
  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  // Thêm interface cho Owner
  interface Owner{
    id: string;
    fullName: string;
    email: string;
  }

  // Trong component ManageRequest, thêm state
  const [owners, setOwners] = useState<Owner[]>([]);

  // Fetch data từ Firestore
  useEffect(() => {
    const q = query(collection(db, "owners"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ownerData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Owner[];
      setOwners(ownerData);
    });
    return () => unsubscribe();
  }, []);
  
  const handleRowClick = async (record: RequestType, source: 'notification' | 'table' = 'table') => {
    if (record.type === 'Định danh chó(mèo)') {
      if (record.status === 'Đã hoàn thành') {
        // Xử lý hiển thị thông tin thú cưng
        setLoading(true);
        try {
          const petDoc = await getDoc(doc(db, "pets", record.id));
          const petData = { id: petDoc.id, ...petDoc.data() } as PetType; 
          setSelectedOwner(defaultOwner);
          
          if (petData.ownerId) {
            const ownerDoc = await getDoc(doc(db, "owners", petData.ownerId));
            const ownerData = ownerDoc.data() as OwnerType;
            setSelectedOwner({ ...defaultOwner, ...ownerData });
          }
          
          setSelectedPet(petData);
          setInfoModalVisible(true);

          // ✅ Nếu được gọi từ NotificationDropdown thì cập nhật message
          if (source === 'notification') {
            const notiQuery = query(
              collection(db, "notifications"),
              where("petId", "==", petData.id)
            );
            const notiSnapshot = await getDocs(notiQuery);
            for (const notiDoc of notiSnapshot.docs) {
              await updateDoc(doc(db, "notifications", notiDoc.id), {
                message: "Seen"
              });
            }
          }

        } catch (error) {
          message.error("Lỗi khi tải thông tin chi tiết");
        }
        setLoading(false);
      } else if (record.status === 'Đang xử lý') {
        setSelectedRequest(record);
        setIsModalVisible(true);
      }
    } else if (record.type === 'Thông tin thiết bị' && record.status === 'Đã hoàn thành') {
      navigate(`/device/${record.id}`); // 👉 chuyển sang trang chi tiết thiết bị
    } else if (record.type === 'Thông tin vi phạm') {
      handleViolationClick(record);
    } else if (record.type === 'Thông tin tiêm phòng') {
      handleVaccinationClick(record);
    }
    
  };

  return (
    <RequestLayout profile={profile} onRowClick={handleRowClick}>
      {() => (
        <div style={{ overflowX: 'hidden' }} className='request'>
          <div className='manage-request-navbar'>
            <div className='manage-request-title'>Yêu cầu về thú cưng</div>
            <Space.Compact size="large">
              <Search
                className='search-bar'
                placeholder="Tìm kiếm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onSearch={(value) => setSearchQuery(value)}
                enterButton
              />
            </Space.Compact>
            <div className='manage-request-button-navbar'>
              <Button style={{ marginRight: 5, marginLeft: 5, backgroundColor: '#5cb85c', color: 'white', fontFamily: 'Segoe UI', fontWeight: 600 }} onClick={() => navigate('/addrequest')}><PlusOutlined /><span className='text-create-new'>Tạo mới</span></Button>
            </div>
          </div>
          <div className='manage-request-content'>
            <Spin spinning={loading}>
                <Table
                  rowKey={(record) => record.id}
                  columns={columns}
                  dataSource={filteredData}
                  pagination={{
                    ...pagination,
                    position: ['bottomRight'],
                    style: { 
                      margin: 0, 
                      position: 'sticky' 
                    },
                    showSizeChanger: true,
                    responsive: true,
                    pageSizeOptions: ['10', '20', '50', '100'],
                    onChange: handlePageChange,
                    onShowSizeChange: handlePageChange,
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
                  }}
                  bordered
                  scroll={{ x: 'max-content' }}
                  onRow={(record) => ({
                    onClick: () => handleRowClick(record),
                    style: {
                      cursor: record.type === 'Định danh chó(mèo)' && 
                             (record.status === 'Đã hoàn thành' || record.status === 'Đang xử lý') 
                        ? 'pointer' 
                        : 'default'
                    }
                  })}
                />
                {infoModalVisible && selectedPet && (
                  <PetInfoModal
                    visible={infoModalVisible}
                    onCancel={() => setInfoModalVisible(false)}
                    pet={selectedPet}
                    owner={selectedOwner || defaultOwner}
                    onViewViolationDetail={(violation) => {
                      handleViolationClick({
                        id: violation.id,
                        type: 'Thông tin vi phạm',
                        status: violation.status,
                        requestCode: '',
                        createdBy: '',
                        createdAt: '',
                        lastModifiedBy: '',
                        lastUpdateTime: ''
                      });
                    }}                    
                    setViolationModalVisible={setViolationModalVisible}
                    setSelectedViolation={setSelectedViolation}
                    violationModalVisible={violationModalVisible}
                    
                    onViewVaccinationDetail={(vaccination) => {
                      handleVaccinationClick({
                        id: vaccination.id,
                        type: 'Thông tin tiêm phòng',
                        status: vaccination.status,
                        requestCode: '',
                        createdBy: '',
                        createdAt: '',
                        lastModifiedBy: '',
                        lastUpdateTime: ''
                      });
                    }}
                    setSelectedVaccination={setSelectedVaccination}
                    setVaccinationModalVisible={setVaccinationModalVisible}
                    vaccinationModalVisible={vaccinationModalVisible}
                  />
                )}
                <Modal
                  title="Định danh thông tin thú cưng"
                  open={isModalVisible}
                  onOk={handleOk}
                  onCancel={handleCancel}
                  okText="Lưu"
                  cancelText="Hủy"
                  centered
                  destroyOnClose
                  width={window.innerWidth < 768 ? '90%' : 600}
                  style={{
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                    maxHeight: '80vh',
                  }}
                  styles={{
                    header: {
                      borderBottom: '1px solid #f0f0f0',
                      padding: '20px 24px',
                      backgroundColor: '#f8f9fa',
                      fontSize: '18px',
                      fontWeight: 600,
                      color: '#1d1d1d'
                    },
                    body: {
                      backgroundColor: '#ffffff',
                      maxHeight: '50vh',
                      overflowY: 'auto',
                      padding: '16px',
                    },
                    footer: {
                      borderTop: '1px solid #f0f0f0',
                      padding: '16px 24px'
                    }
                  }}
                >
                  <Form
                    form={form}
                    layout="vertical"
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '16px'
                    }}
                  >
                    {/* Global style cho các form item */}
                    <style>{`
                      .ant-form-item-control-input {
                        min-height: 40px !important;
                      }
                      .ant-input-number, .ant-input-number-input-wrap {
                        height: 40px !important;
                      }
                      .ant-select-selector {
                        height: 40px !important;
                        align-items: center !important;
                      }
                    `}</style>

                    {/* Row 1 - Tên thú cưng */}
                    <Form.Item
                      name="name"
                      label={<span style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#2d3436', fontSize: '14px' }}>Tên thú cưng</span>}
                      rules={[
                        { required: true, message: 'Vui lòng nhập tên!' },
                        { max: 16, message: 'Tên không được vượt quá 16 ký tự!' }
                      ]}
                      style={{ flex: '1 1 100%', marginBottom: 0 }}
                    >
                      <Input
                        placeholder="VD: Milu,..."
                        style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0',
                          fontSize: '14px',
                          lineHeight: '1.5',
                          height: '40px',
                          width: '100%'
                        }}
                      />
                    </Form.Item>

                    {/* Row 2 - Loài và Giống */}
                    <Form.Item
                      name="species"
                      label={<span style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#2d3436', fontSize: '14px' }}>Loài</span>}
                      rules={[
                        { required: true, message: 'Vui lòng chọn loài!' },
                        { max: 16, message: 'Loài không được vượt quá 16 ký tự!' }
                      ]}
                      style={{ flex: '1 1 48%', marginBottom: 0 }}
                    >
                      <Select
                        placeholder="VD: Chó, Mèo,..."
                        style={{
                          width: '100%',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0',
                          height: '40px'
                        }}
                        dropdownStyle={{
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          padding: '8px 0'
                        }}
                      >
                        <Select.Option value="Chó" style={{ padding: '10px 16px', height: '40px', display: 'flex', alignItems: 'center' }}>Chó</Select.Option>
                        <Select.Option value="Mèo" style={{ padding: '10px 16px', height: '40px', display: 'flex', alignItems: 'center' }}>Mèo</Select.Option>
                      </Select>
                    </Form.Item>

                    <Form.Item
                      name="breed"
                      label={<span style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#2d3436', fontSize: '14px' }}>Giống</span>}
                      style={{ flex: '1 1 48%', marginBottom: 0 }}
                      rules={[
                        { required: true, message: 'Vui lòng nhập giống!' },
                        { max: 16, message: 'Giống không được vượt quá 16 ký tự!' }
                      ]}
                    >
                      <Input
                        placeholder="VD: Poodle,..."
                        style={{
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0',
                          fontSize: '14px',
                          height: '40px',
                          width: '100%'
                        }}
                      />
                    </Form.Item>

                    {/* Row 3 - Tuổi, Giới tính, Vaccine */}
                    <Form.Item
                      required
                      name="age"
                      label={<span style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#2d3436', fontSize: '14px' }}>Tuổi</span>}
                      rules={[{ type: 'number', min: 0, max: 50 }]}
                      style={{ flex: '1 1 30%', marginBottom: 0 }}
                    >
                      <div style={{ height: '40px' }}>
                        <InputNumber
                          min={0}
                          max={50}
                          placeholder="VD: 2"
                          style={{
                            width: '100%',
                            borderRadius: '8px',
                            border: '1px solid #e0e0e0',
                            height: '40px'
                          }}
                          formatter={(value) => `${value}`}
                          onChange={(value) => {
                            form.setFieldsValue({ age: Number(value) });
                          }}
                        />
                      </div>
                    </Form.Item>

                    <Form.Item
                      required
                      name="gender"
                      label={<span style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#2d3436', fontSize: '14px' }}>Giới tính</span>}
                      style={{ flex: '1 1 30%', marginBottom: 0 }}
                    >
                      <Select
                        placeholder="Chọn giới tính"
                        style={{
                          width: '100%',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0',
                          height: '40px'
                        }}
                      >
                        <Select.Option value="male" style={{ padding: '10px 16px', height: '40px', display: 'flex', alignItems: 'center' }}>Đực</Select.Option>
                        <Select.Option value="female" style={{ padding: '10px 16px', height: '40px', display: 'flex', alignItems: 'center' }}>Cái</Select.Option>
                      </Select>
                    </Form.Item>

                    <Form.Item
                      name="vaccinationStatus"
                      label={<span style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#2d3436', fontSize: '14px' }}>Vaccine</span>}
                      style={{ flex: '1 1 30%', marginBottom: 0 }}
                    >
                      <Select
                        placeholder="VD: Đã tiêm đủ"
                        style={{
                          width: '100%',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0',
                          height: '40px'
                        }}
                      >
                        <Select.Option value="Đã tiêm đủ" style={{ padding: '10px 16px', height: '40px', display: 'flex', alignItems: 'center' }}>Đã tiêm đủ</Select.Option>
                        <Select.Option value="Chưa tiêm đủ" style={{ padding: '10px 16px', height: '40px', display: 'flex', alignItems: 'center' }}>Chưa tiêm đủ</Select.Option>
                      </Select>
                    </Form.Item>

                    {/* Row 4 - Sức khỏe */}
                    <Form.Item
                      name="healthStatus"
                      label={<span style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#2d3436', fontSize: '14px' }}>Tình trạng sức khỏe</span>}
                      style={{ flex: '1 1 100%', marginBottom: 0 }}
                    >
                      <Input.TextArea
                        rows={3}
                        placeholder="Mô tả tình trạng sức khỏe"
                        style={{
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0',
                          resize: 'vertical',
                          padding: '10px 14px',
                          fontSize: '14px',
                          minHeight: '40px',
                          width: '100%'
                        }}
                      />
                    </Form.Item>

                    {/* Row 5 - Vi phạm */}
                    <Form.Item
                      name="violationStatus"
                      label={<span style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#2d3436', fontSize: '14px' }}>Thông tin vi phạm</span>}
                      style={{ flex: '1 1 100%', marginBottom: 0 }}
                    >
                      <Input.TextArea
                        rows={3}
                        placeholder="Mô tả tình trạng vi phạm"
                        style={{
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0',
                          resize: 'vertical',
                          padding: '10px 14px',
                          fontSize: '14px',
                          minHeight: '40px',
                          width: '100%'
                        }}
                      />
                    </Form.Item>

                    {/* Row 6 - Chủ nuôi */}
                    <Form.Item
                      name="ownerId"
                      label={<span style={{ display: 'block', marginBottom: '8px', fontWeight: 500, color: '#2d3436', fontSize: '14px' }}>Chủ nuôi</span>}
                      rules={[{ required: true, message: 'Vui lòng chọn chủ nuôi!' }]}
                      style={{ flex: '1 1 100%', marginBottom: 0 }}
                    >
                      <Select
                        showSearch
                        placeholder="Chọn chủ nuôi"
                        optionFilterProp="children"
                        filterOption={(input, option) =>
                          (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                        }
                        options={owners.map(owner => ({
                          value: owner.id,
                          label: `${owner.fullName} <${owner.email}>`
                        }))}
                        style={{
                          width: '100%',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0',
                          height: '40px'
                        }}
                        dropdownStyle={{
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                      />
                    </Form.Item>
                  </Form>
                </Modal>

                <Modal
                  title={<span style={{ 
                    fontSize: '22px',
                    fontWeight: 700,
                    color: '#1890ff',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <FileTextOutlined /> Chi tiết vi phạm
                  </span>}
                  open={violationModalVisible}
                  onCancel={() => setViolationModalVisible(false)}
                  footer={selectedViolation?.status === "Chưa giải quyết" ? [
                    <Button 
                      key="resolve" 
                      type="primary"
                      style={{ 
                        backgroundColor: '#52c41a',
                        borderColor: '#52c41a',
                        fontWeight: 600,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        borderRadius: '6px',
                        padding: '0 24px',
                        height: '40px',
                        transition: 'all 0.3s',
                      }}
                      onClick={async () => {
                        try {
                          const now = new Date();
                          const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
                          await updateDoc(doc(db, "violations", selectedViolation.id), {
                            status: "Active",
                            resolvedAt: formattedDate,
                            resolvedBy: localStorage.getItem('email') || 'Unknown'
                          });
                          message.success("Đã giải quyết vi phạm thành công!");
                          setViolationModalVisible(false);
                        } catch (error) {
                          message.error("Lỗi khi cập nhật trạng thái vi phạm");
                        }
                      }}
                    >
                      <CheckCircleOutlined /> Giải quyết
                    </Button>
                  ]: null}
                  width={window.innerWidth < 768 ? '90%' : 800}
                  centered
                  destroyOnClose
                  style={{
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 12px 48px rgba(0, 0, 0, 0.2)',
                    maxHeight: '80vh',
                    border: '1px solid #e8e8e8'
                  }}
                  styles={{
                    header: {
                      borderBottom: '2px solid #f0f0f0',
                      padding: '20px 32px',
                      backgroundColor: '#fafafa'
                    },
                    body: { 
                      maxHeight: '50vh', 
                      overflowY: 'auto',
                      padding: '32px',
                      fontSize: '15px',
                      background: 'linear-gradient(to bottom, #ffffff, #f8fbff)'
                    },
                    footer: {
                      borderTop: '2px solid #f0f0f0',
                      padding: '10px 22px',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '16px',
                      backgroundColor: '#fafafa'
                    }
                  }}
                >
                  {selectedViolation && (
                    <Descriptions 
                      column={1} 
                      bordered
                      labelStyle={{
                        fontWeight: 600,
                        color: '#2d2d2d',
                        backgroundColor: '#f5f5f5',
                        width: '200px',
                        padding: '14px 24px',
                        fontSize: '15px',
                        borderRight: '1px solid #e8e8e8'
                      }}
                      contentStyle={{
                        fontSize: '15px',
                        color: '#434343',
                        padding: '16px 24px',
                        backgroundColor: '#ffffff',
                        minHeight: '52px'
                      }}
                    >
                      <Descriptions.Item label="Mã vi phạm">
                        <Tag color="blue" style={{ 
                          fontSize: 14,
                          padding: '4px 12px',
                          borderRadius: '4px',
                          fontWeight: 500 
                        }}>
                          #{selectedViolation.id}
                        </Tag>
                      </Descriptions.Item>
                      
                      <Descriptions.Item label="Trạng thái">
                        <Tag 
                          color={selectedViolation.status === "Chưa giải quyết" ? "orange" : "green"}
                          style={{ 
                            fontSize: 14,
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontWeight: 500,
                            textTransform: 'uppercase'
                          }}
                        >
                          {selectedViolation.status === "Chưa giải quyết" ? "Chưa giải quyết" : "Đã hoàn thành"}
                        </Tag>
                      </Descriptions.Item>

                      <Descriptions.Item label="Ngày tạo">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CalendarOutlined style={{ color: '#666' }} />
                          {selectedViolation.createdAt || 'N/A'}
                        </div>
                      </Descriptions.Item>

                      <Descriptions.Item label="Người thông báo">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <UserOutlined style={{ color: '#666' }} />
                          {selectedViolation.notificationBy || 'N/A'}
                        </div>
                      </Descriptions.Item>

                      {selectedViolation.status === "Đã hoàn thành" && (
                        <>
                          <Descriptions.Item label="Người giải quyết">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <UserOutlined style={{ color: '#666' }} />
                              {selectedViolation.resolvedBy || 'N/A'}
                            </div>
                          </Descriptions.Item>

                          <Descriptions.Item label="Thời gian giải quyết">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <ClockCircleOutlined style={{ color: '#666' }} />
                              {formatDate(selectedViolation.resolvedAt) || 'N/A'}
                            </div>
                          </Descriptions.Item>
                        </>
                      )}

                      <Descriptions.Item label="Thông tin thú cưng">
                        {selectedPetInViolation ? (
                          <div style={{ lineHeight: 1.6 }}>
                            <div>
                              <EnvironmentOutlined /> Tên: {selectedPetInViolation.name || 'N/A'}
                            </div>
                            <div>
                              <TagOutlined /> Loài: {selectedPetInViolation.species || 'N/A'}
                            </div>
                            <div>
                              <ExperimentOutlined /> Giống: {selectedPetInViolation.breed || 'N/A'}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#8c8c8c' }}>Không có thông tin thú cưng</span>
                        )}
                        <Button 
                          type="primary" 
                          ghost
                          onClick={async () => {
                            try {
                              setLoading(true);
                              // Lấy ID thú cưng từ vi phạm
                              const petId = selectedViolation.petId;
                              
                              // Fetch thông tin thú cưng từ Firestore
                              const petDoc = await getDoc(doc(db, "pets", petId));
                              const petData = { id: petDoc.id, ...petDoc.data() } as PetType;
                              
                              // Fetch thông tin chủ sở hữu
                              let ownerData = defaultOwner;
                              if (petData.ownerId) {
                                const ownerDoc = await getDoc(doc(db, "owners", petData.ownerId));
                                ownerData = { ...defaultOwner, ...ownerDoc.data() };
                              }

                              // Hiển thị modal thông tin thú cưng
                              setSelectedPet(petData);
                              setSelectedOwner(ownerData);
                              setInfoModalVisible(true);
                              setViolationModalVisible(false); // Đóng modal vi phạm
                            } catch (error) {
                              message.error("Lỗi khi tải thông tin thú cưng");
                            } finally {
                              setLoading(false);
                            }
                          }}
                          style={{ 
                            borderRadius: '8px',
                            borderColor: '#1890ff',
                            color: '#1890ff',
                            fontWeight: 500,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <ArrowRightOutlined /> Xem chi tiết
                        </Button>
                      </Descriptions.Item>

                      <Descriptions.Item label="Thông tin chủ nuôi">
                        {selectedOwnerInViolation ? (
                          <div style={{ lineHeight: 1.6 }}>
                            <div>
                              <UserOutlined /> Tên: {selectedOwnerInViolation.fullName || 'N/A'}
                            </div>
                            <div>
                              <PhoneOutlined /> Điện thoại: {selectedOwnerInViolation.phone || 'N/A'}
                            </div>
                            <div>
                              <HomeOutlined /> Địa chỉ: {selectedOwnerInViolation.address || 'N/A'}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#8c8c8c' }}>Không có thông tin chủ nuôi</span>
                        )}
                      </Descriptions.Item>

                      <Descriptions.Item label="Mô tả vi phạm">
                        <div style={{ 
                          backgroundColor: '#fffbe6',
                          padding: '16px',
                          borderRadius: '8px',
                          borderLeft: '4px solid #ffe58f',
                          margin: '8px 0'
                        }}>
                          {selectedViolation.description || <span style={{ color: '#bfbfbf' }}>N/A</span>}
                        </div>
                      </Descriptions.Item>

                      <Descriptions.Item label="Ghi chú">
                        <div style={{ 
                          padding: '12px',
                          backgroundColor: '#f8f8f8',
                          borderRadius: '6px',
                          fontStyle: 'italic'
                        }}>
                          {selectedViolation.notes || <span style={{ color: '#bfbfbf' }}>Không có ghi chú</span>}
                        </div>
                      </Descriptions.Item>

                      <Descriptions.Item label="Địa điểm vi phạm">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <EnvironmentOutlined style={{ color: '#666' }} />
                          {selectedViolation.violationLocation || 'N/A'}
                        </div>
                      </Descriptions.Item>

                      <Descriptions.Item label="Thời gian vi phạm">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <ClockCircleOutlined style={{ color: '#666' }} />
                          {formatDate(selectedViolation.violationTime) || 'N/A'}
                        </div>
                      </Descriptions.Item>

                      <Descriptions.Item label="Hình ảnh đính kèm">
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                          gap: '16px',
                          padding: '8px 0'
                        }}>
                          {selectedViolation.attachments?.length ? 
                            selectedViolation.attachments.map((img: string, index: number) => (
                              <Image
                                key={index}
                                width={150}
                                height={150}
                                src={img}
                                style={{ 
                                  borderRadius: '12px',
                                  border: '1px solid #f0f0f0',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                  transition: 'transform 0.2s',
                                  cursor: 'pointer',
                                  objectFit: 'cover',
                                  aspectRatio: '1'
                                }}
                                preview={{
                                  maskStyle: { 
                                    borderRadius: '8px',
                                    backgroundColor: 'rgba(0,0,0,0.2)'
                                  }
                                }}
                                alt={`Ảnh vi phạm ${index + 1}`}
                              />
                            )) : 
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px', 
                              color: '#8c8c8c', 
                              fontStyle: 'italic'
                            }}>
                              <PictureOutlined /> Không có hình ảnh
                            </div>
                          }
                        </div>
                      </Descriptions.Item>

                    </Descriptions>
                  )}
                </Modal>

                <Modal
                  title={
                    <span style={{
                      fontSize: '22px',
                      fontWeight: 700,
                      color: '#1890ff',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <FileTextOutlined /> Chi tiết tiêm phòng
                    </span>
                  }
                  open={vaccinationModalVisible}
                  onCancel={() => setVaccinationModalVisible(false)}
                  footer={selectedVaccination?.status === "Pending" ? [
                    <Button
                      key="confirm-vaccinated"
                      type="primary"
                      style={{ 
                        backgroundColor: '#52c41a',
                        borderColor: '#52c41a',
                        fontWeight: 600,
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        borderRadius: '6px',
                        padding: '0 24px',
                        height: '40px',
                        transition: 'all 0.3s',
                      }}
                      onClick={async () => {
                        try {
                          const now = new Date();
                          const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
                          
                          // Lấy vaccination document
                          const vaccinationRef = doc(db, "vaccinations", selectedVaccination.id);
                          const vaccinationSnap = await getDoc(vaccinationRef);
                          if (!vaccinationSnap.exists()) {
                            message.error("Không tìm thấy dữ liệu tiêm phòng!");
                            return;
                          }
                  
                          const data = vaccinationSnap.data();
                          const updatedSenderTo = (data.senderTo || []).map((entry: any) => {
                            if (entry.userId === selectedVaccination.userId) {
                              return {
                                ...entry,
                                status: "Active",
                                resolvedAt: formattedDate,
                                resolvedBy: localStorage.getItem('email') || 'Unknown'
                              };
                            }
                            return entry;
                          });                          
                  
                          await updateDoc(vaccinationRef, {
                            senderTo: updatedSenderTo
                          });                          
                  
                          message.success("Đã xác nhận hoàn thành tiêm phòng!");
                          setVaccinationModalVisible(false);
                        } catch (error) {
                          message.error("Lỗi khi cập nhật trạng thái tiêm phòng");
                        }
                      }}
                    >
                      <CheckCircleOutlined /> Xác nhận đã tiêm
                    </Button>
                  ] : null}                  
                  width={window.innerWidth < 768 ? '90%' : 800}
                  centered
                  destroyOnClose
                  style={{
                    borderRadius: '16px',
                    overflow: 'hidden',
                    boxShadow: '0 12px 48px rgba(0, 0, 0, 0.2)',
                    maxHeight: '80vh',
                    border: '1px solid #e8e8e8'
                  }}
                  styles={{
                    header: {
                      borderBottom: '2px solid #f0f0f0',
                      padding: '20px 32px',
                      backgroundColor: '#fafafa'
                    },
                    body: { 
                      maxHeight: '50vh', 
                      overflowY: 'auto',
                      padding: '32px',
                      fontSize: '15px',
                      background: 'linear-gradient(to bottom, #ffffff, #f8fbff)'
                    },
                    footer: {
                      borderTop: '2px solid #f0f0f0',
                      padding: '10px 22px',
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '16px',
                      backgroundColor: '#fafafa'
                    }
                  }}
                >
                  {selectedVaccination && (
                    <Descriptions
                      column={1}
                      bordered
                      labelStyle={{
                        fontWeight: 600,
                        color: '#2d2d2d',
                        backgroundColor: '#f5f5f5',
                        width: '200px',
                        padding: '14px 24px',
                        fontSize: '15px',
                        borderRight: '1px solid #e8e8e8'
                      }}
                      contentStyle={{
                        fontSize: '15px',
                        color: '#434343',
                        padding: '16px 24px',
                        backgroundColor: '#ffffff',
                        minHeight: '52px'
                      }}
                    >
                      {/* Mã yêu cầu */}
                      <Descriptions.Item label="Mã tiêm phòng">
                        <Tag color="blue" style={{
                          fontSize: 14,
                          padding: '4px 12px',
                          borderRadius: '4px',
                          fontWeight: 500
                        }}>
                          #{selectedVaccination.id}
                        </Tag>
                      </Descriptions.Item>

                      {/* Trạng thái riêng biệt */}
                      <Descriptions.Item label="Trạng thái">
                        <Tag
                          color={selectedVaccination.status === "Pending" ? "orange" : "green"}
                          style={{
                            fontSize: 14,
                            padding: '6px 12px',
                            borderRadius: '20px',
                            fontWeight: 500,
                            textTransform: 'uppercase'
                          }}
                        >
                          {selectedVaccination.status === "Pending" ? "Chưa giải quyết" : "Đã hoàn thành"}
                        </Tag>
                      </Descriptions.Item>

                      {/* Thông tin thời gian và người thông báo */}
                      <Descriptions.Item label="Ngày tạo">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <CalendarOutlined style={{ color: '#666' }} />
                          {selectedVaccination.createdAt || 'N/A'}
                        </div>
                      </Descriptions.Item>

                      <Descriptions.Item label="Người thông báo">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <UserOutlined style={{ color: '#666' }} />
                          {selectedVaccination.notificationBy || 'N/A'}
                        </div>
                      </Descriptions.Item>

                      {selectedVaccination.status === "Active" && (
                        <>
                          <Descriptions.Item label="Người xác nhận">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <UserOutlined style={{ color: '#666' }} />
                              {selectedVaccination.resolvedBy || 'N/A'}
                            </div>
                          </Descriptions.Item>

                          <Descriptions.Item label="Thời gian xác nhận">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <ClockCircleOutlined style={{ color: '#666' }} />
                              {formatDate(selectedVaccination.resolvedAt) || 'N/A'}
                            </div>
                          </Descriptions.Item>
                        </>
                      )}

                      {/* Thông tin thú cưng */}
                      <Descriptions.Item label="Thông tin thú cưng">
                        {selectedPetInVaccination ? (
                          <div style={{ lineHeight: 1.6 }}>
                            <div>
                              <EnvironmentOutlined /> Tên: {selectedPetInVaccination.name || 'N/A'}
                            </div>
                            <div>
                              <TagOutlined /> Loài: {selectedPetInVaccination.species || 'N/A'}
                            </div>
                            <div>
                              <ExperimentOutlined /> Giống: {selectedPetInVaccination.breed || 'N/A'}
                            </div>
                            <Button 
                              type="primary" 
                              ghost
                              onClick={async () => {
                                try {
                                  setLoading(true);
                                  const petId = selectedPetInVaccination.id;
                                  const petDoc = await getDoc(doc(db, "pets", petId));
                                  const petData = { id: petDoc.id, ...petDoc.data() } as PetType;

                                  let ownerData = defaultOwner;
                                  if (petData.ownerId) {
                                    const ownerDoc = await getDoc(doc(db, "owners", petData.ownerId));
                                    ownerData = { ...defaultOwner, ...ownerDoc.data() };
                                  }

                                  setSelectedPet(petData);
                                  setSelectedOwner(ownerData);
                                  setInfoModalVisible(true);
                                  setVaccinationModalVisible(false);
                                } catch (error) {
                                  message.error("Lỗi khi tải thông tin thú cưng");
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              style={{
                                marginTop: 8,
                                borderRadius: 8,
                                borderColor: '#1890ff',
                                color: '#1890ff',
                                fontWeight: 500,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8
                              }}
                            >
                              <ArrowRightOutlined /> Xem chi tiết
                            </Button>
                          </div>
                        ) : (
                          <span style={{ color: '#8c8c8c', fontStyle: 'italic' }}>Không có thông tin thú cưng</span>
                        )}
                      </Descriptions.Item>

                      {/* Thông tin chủ nuôi */}
                      <Descriptions.Item label="Thông tin chủ nuôi">
                        {selectedOwnerInVaccination ? (
                          <div style={{ lineHeight: 1.6 }}>
                            <div>
                              <UserOutlined /> Tên: {selectedOwnerInVaccination.fullName || 'N/A'}
                            </div>
                            <div>
                              <PhoneOutlined /> Điện thoại: {selectedOwnerInVaccination.phone || 'N/A'}
                            </div>
                            <div>
                              <HomeOutlined /> Địa chỉ: {selectedOwnerInVaccination.address || 'N/A'}
                            </div>
                          </div>
                        ) : (
                          <span style={{ color: '#8c8c8c' }}>Không có thông tin chủ nuôi</span>
                        )}
                      </Descriptions.Item>

                      <Descriptions.Item label="Thời gian (từ ngày)">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <ClockCircleOutlined style={{ color: '#666' }} />
                          {selectedVaccination.timeFrom || 'N/A'}
                        </div>
                      </Descriptions.Item>

                      <Descriptions.Item label="Thời gian (đến ngày)">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <ClockCircleOutlined style={{ color: '#666' }} />
                          {selectedVaccination.timeTo || 'N/A'}
                        </div>
                      </Descriptions.Item>

                      {/* Thông tin vaccine */}
                      <Descriptions.Item label="Địa điểm tiêm">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <EnvironmentOutlined style={{ color: '#666' }} />
                          {selectedVaccination.vaccineLocation || 'N/A'}
                        </div>
                      </Descriptions.Item>

                      <Descriptions.Item label="Cơ quan ban hành">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <HomeOutlined style={{ color: '#666' }} />
                          {selectedVaccination.issuingAuthority || 'N/A'}
                        </div>
                      </Descriptions.Item>

                      <Descriptions.Item label="Loại vaccine">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <TagOutlined style={{ color: '#666' }} />
                          {selectedVaccination.vaccineType || 'Không có'}
                        </div>
                      </Descriptions.Item>

                      <Descriptions.Item label="Chi phí">
                        {selectedVaccination.cost ? `${selectedVaccination.cost} VNĐ` : 'Không có'}
                      </Descriptions.Item>

                      <Descriptions.Item label="Ghi chú">
                        <div style={{
                          padding: '12px',
                          backgroundColor: '#f8f8f8',
                          borderRadius: '6px',
                          fontStyle: 'italic'
                        }}>
                          {selectedVaccination.notes || <span style={{ color: '#bfbfbf' }}>Không có ghi chú</span>}
                        </div>
                      </Descriptions.Item>
                
                    </Descriptions>
                  )}
                </Modal>
            </Spin>
          </div>
        </div>
      )}
    </RequestLayout>
  )
}

const mapStateToProps = (state: RootState) => ({
  tab: state.request.tab,
  status: state.request.status,
  userInfo: state.request.userInfo
})

const mapDispatchToProps = { setTab, setStatus }

export default connect(mapStateToProps, mapDispatchToProps)(ManageRequest)