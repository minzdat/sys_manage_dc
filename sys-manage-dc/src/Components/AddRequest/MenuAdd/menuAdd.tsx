import React, { JSX } from 'react'; // thêm useState
import { Menu, message } from 'antd';
import { ArrowLeftOutlined, SendOutlined } from '@ant-design/icons';
import './menuAdd.css';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db } from "../../../Firebase/FirebaseConfig"; // đã có sẵn db
import { FormData } from '../AddRequest/addRequest';
import dayjs from 'dayjs';
import { uploadImageToCloudinary } from '../../../Services/cloudinaryService';
import { RcFile } from 'antd/es/upload';

interface MenuAddProps {
    formData: FormData;
    setFormData: React.Dispatch<React.SetStateAction<FormData>>;
    fileList: RcFile[];
    setFileList: React.Dispatch<React.SetStateAction<RcFile[]>>;
    setLoading: React.Dispatch<React.SetStateAction<boolean>>; 
    listOfUserId: string[]; 
}

function MenuAdd({ formData, setFormData, fileList, setFileList, setLoading, listOfUserId}: MenuAddProps): JSX.Element {
    const navigate = useNavigate();

    const handleReturn = () => {
        navigate("/");
    };

    const handleSubmit = async () => {
        const createdAt = dayjs().format('YYYY-MM-DDTHH:mm:ss');
        const userEmail = localStorage.getItem('email') || '';
        setLoading(true);
    
        try {
            if (formData.notificationType === 'violation') {
                const {
                    petId,
                    violationLocation,
                    violationTime,
                    description,
                    notes,
                    ownerId
                } = formData;
    
                if (!petId || !violationLocation || !violationTime || !description || !ownerId) {
                    message.error("Vui lòng điền đầy đủ các trường bắt buộc cho vi phạm!");
                    setLoading(false);
                    return;
                }
    
                const uploadedUrls = fileList.length > 0
                    ? await Promise.all(fileList.map(uploadImageToCloudinary))
                    : [];
    
                const violationData = {
                    petId,
                    ownerId,
                    violationLocation,
                    violationTime,
                    description,
                    notes: notes || "",
                    createdAt,
                    status: 'Pending',
                    notificationBy: userEmail,
                    attachments: uploadedUrls,
                };
    
                await addDoc(collection(db, 'violations'), violationData);
                message.success("Gửi thông báo vi phạm thành công!");
                navigate("/");
            }
    
            else if (formData.notificationType === 'vaccination') {
                const {
                    vaccineType,
                    vaccineLocation,
                    cost,
                    vaccineFrom,
                    vaccineTo,
                    notes,
                    issuingAuthority
                } = formData;
    
                if (!vaccineType || !vaccineLocation || !cost || !vaccineFrom || !vaccineTo || !issuingAuthority) {
                    message.error("Vui lòng điền đầy đủ các trường bắt buộc cho tiêm phòng!");
                    setLoading(false);
                    return;
                }
    
                const vaccinationData = {
                    createdAt,
                    vaccineType,
                    vaccineLocation,
                    cost,
                    timeFrom: vaccineFrom,
                    timeTo: vaccineTo,
                    notes: notes || "",
                    issuingAuthority,
                    // status: 'Pending',
                    notificationBy: userEmail,
                    senderTo: listOfUserId.map(userId => ({ 
                        userId, 
                        status: 'Pending'
                    })),
                };
    
                await addDoc(collection(db, 'vaccinations'), vaccinationData);
                message.success("Gửi thông báo tiêm phòng thành công!");
                navigate("/");
            }
    
            else {
                message.error("Loại thông báo không hợp lệ!");
            }
        } catch (error) {
            console.error("Lỗi khi gửi yêu cầu:", error);
            message.error("Gửi yêu cầu thất bại!");
        } finally {
            setLoading(false);
        }
    };    

    return (
        <div className='menu-detail-request'>
            <Menu mode="horizontal" className='fixed-menu'>
                <Menu.Item onClick={handleReturn} key="return" icon={<ArrowLeftOutlined />}>
                    Quay lại
                </Menu.Item>
                <Menu.Item onClick={handleSubmit} key="submit" icon={<SendOutlined />}>
                    Gửi yêu cầu
                </Menu.Item>
            </Menu>
        </div>
    );
}

export default MenuAdd;
