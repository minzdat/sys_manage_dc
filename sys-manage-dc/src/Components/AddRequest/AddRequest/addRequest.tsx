import MenuAdd from '../MenuAdd/menuAdd';
import SendApprover from '../SendApprover/sendApprover';
import RequestLayout from '../../RequestLayout';
import { Col, Input, Row, Form, Select, DatePicker, Spin, Alert, Upload, Button, message} from 'antd';
import './addRequest.css'
import '../SendApprover/sendApprover.css'
import { ChangeEvent, JSX, useEffect, useState } from 'react';
import dayjs, { Dayjs } from 'dayjs';
import { RcFile } from 'antd/es/upload';
import { db } from "../../../Firebase/FirebaseConfig"; 
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { DocumentSnapshot, DocumentData } from 'firebase/firestore';
import { UploadOutlined } from '@ant-design/icons';
import { UploadFile } from 'antd/lib/upload';

export interface FormData {
    notificationType?: string;
    petId?: string;
    violationLocation?: string;
    violationTime?: string;
    description?: string;
    notes?: string;
    [key: string]: any;
}

function AddRequest(): JSX.Element {

    //set layout
    const profile = false;

    const [notificationOptions] = useState([
        { value: 'vaccination', label: 'Tiêm phòng' },
        { value: 'violation', label: 'Vi phạm' }
      ]);
    const [loading, setLoading] = useState<boolean>(false);
    const [fileList, setFileList] = useState<RcFile[]>([]);
    const [applyNote, setApplyNote] = useState<boolean>(false);
    const [listOfUserId, setListOfUserId] = useState<string[]>([]);
    const [petOptions, setPetOptions] = useState<{ value: string; label: string }[]>([]);

    //set initial formData
    const [ownerInfo, setOwnerInfo] = useState<{ fullName: string; phone: string }>({
        fullName: "",
        phone: ""
    });
    //set formData post Api to server 
    const [formData, setFormData] = useState<FormData>({});

    useEffect(() => {
        let unsubscribe: () => void;
      
        const fetchActivePets = async () => {
          try {
            setLoading(true);
            const q = query(
              collection(db, 'pets'),
              where('status', '==', 'Active')
            );
      
            // Thiết lập real-time listener
            unsubscribe = onSnapshot(q, (querySnapshot) => {
              const options = querySnapshot.docs.map(doc => ({
                value: doc.id,
                label: `${doc.data().name} <${doc.id}>`
              }));
              setPetOptions(options);
              setLoading(false);
            }, (error) => {
              console.error('Error listening to pets:', error);
              setLoading(false);
            });
      
          } catch (error) {
            console.error('Error initializing listener:', error);
            setLoading(false);
          }
        };
      
        fetchActivePets();
      
        // Cleanup listener khi component unmount
        return () => {
          if (unsubscribe) unsubscribe();
        };
    }, []);

    useEffect(() => {
        let unsubscribePet: () => void;
        let unsubscribeOwner: () => void;
    
        const fetchOwnerInfo = async (petId: string) => {
            try {
                
                const petRef = doc(db, 'pets', petId);
                unsubscribePet = onSnapshot(petRef, (petDoc: DocumentSnapshot<DocumentData>) => {
                    if (!petDoc.exists()) {
                        console.error("Pet document not found!");
                        return;
                    }
    
                    const petData = petDoc.data();
                    const ownerId = petData?.ownerId;
                    
                    if (!ownerId) {
                        console.error("Owner ID not found in pet document");
                        return;
                    }
                        
                    const ownerRef = doc(db, 'owners', ownerId);
                    unsubscribeOwner = onSnapshot(ownerRef, (ownerDoc: DocumentSnapshot<DocumentData>) => {
                        if (!ownerDoc.exists()) {
                            console.error("Owner document not found!");
                            return;
                        }
    
                        const ownerData = ownerDoc.data();
                        
                        setOwnerInfo({
                            fullName: ownerData?.fullName || "",
                            phone: ownerData?.phone || ""
                        });
                        
                        setFormData(prev => ({
                            ...prev,
                            ownerEmail: ownerData?.email,
                            phone: ownerData?.phone,
                            ownerId: ownerId,
                        }));
                    });
                });
            } catch (error) {
                console.error("Error fetching owner info:", error);
            }
        };
    
        if (formData.petId) {
            fetchOwnerInfo(formData.petId);
        }
    
        return () => {
            unsubscribePet?.();
            unsubscribeOwner?.();
        };
    }, [formData.petId]);

    const handleBeforeUpload = (file: RcFile) => {
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        const acceptedFileExtensions = ['png', 'jpg', 'jpeg', 'pdf', 'csv', 'doc', 'docx', 'pptx', 'ppt', 'txt', 'xls', 'xlsx'];
        if (fileExtension && !acceptedFileExtensions.includes(fileExtension)) {
            message.error(`File type not supported: ${fileExtension}`);
            return false;
        } else {
            setFileList([...fileList, file]);
            return false;
        }
    };

    const handleRemoveFile = (file: UploadFile<any>) => {
        const updatedFileList = fileList.filter((item) => item.uid !== file.uid);
        setFileList(updatedFileList);
    };

    //set Mobile, Cost Center, Total passengers, Pick location, Destination, Reason values ​​for formdata
    const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = event.target;
        setFormData((prevFormData) => ({
            ...prevFormData,
            [name]: value,
        }));
    };

    //set User values ​​for formdata
    const handleSelectChange = (value: any, field: string) => {
        if (field === 'notificationType') {
            setFormData(prev => ({
              ...prev,
              notificationType: value // Giá trị đã là chuỗi trực tiếp
            }));
        }
        if (field === 'petId') {
            const petIdValue = value.value; // Lấy giá trị thực từ object
            setFormData((prevFormData) => ({
                ...prevFormData,
                [field]: petIdValue,
            }));
        } 
        else {
            setFormData((prevFormData) => ({
                ...prevFormData,
                [field]: value,
            }));
        }
    };

    //set Usage time from, Usage time to, Pick time values ​​for formdata
    const handleDatePicker = (value: Dayjs | null, field: string) => {
        if (value) {
            const formattedValue = value.format('YYYY-MM-DDTHH:mm:ss');
            setFormData((prevFormData) => ({
                ...prevFormData,
                [field]: formattedValue,
            }));
        }
    };

    return (
        <RequestLayout profile={profile}>
            {() => (
                <div className='page-request'>
                    <MenuAdd formData={formData} setFormData={setFormData} fileList={fileList} setFileList={setFileList} setLoading={setLoading}  listOfUserId={listOfUserId}/>
                    <div className='page-content'>
                        {loading
                            ?
                            (<Spin style={{ height: '100vh' }} tip="Loading..." size="large">
                                <Alert
                                    style={{ width: '100%', textAlign: 'center' }}
                                    message="Loading..."
                                    description="Vui lòng chờ trong giây lát. Đừng tải lại trang."
                                    type="info"
                                />
                            </Spin>)
                            :
                            (
                                <>
                                    <div className='table-request'>
                                        <h2 className='title-request'>YÊU CẦU QUẢN LÝ THÚ CƯNG</h2>
                                        <div className='table-content'>
                                            <Form
                                                className='form-add-request'
                                            >
                                                <Row className='row-request'>
                               
                                                    {/* Notification Type */}
                                                    <Col xs={24} sm={24} md={12} lg={8} xl={6} className='col-request'>
                                                        <Form.Item
                                                            label="Loại thông báo"
                                                            name="notificationType"
                                                            rules={[{ required: true, message: "Vui lòng chọn loại thông báo" }]}
                                                            labelCol={{ span: 24 }}
                                                        >
                                                            <Select
                                                                showSearch
                                                                optionFilterProp="children"
                                                                filterOption={(input, option) =>
                                                                    (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                                                }
                                                                onChange={(selectedOption) => handleSelectChange(selectedOption, 'notificationType')}
                                                                placeholder='Vui lòng chọn loại thông báo'
                                                                options={notificationOptions}
                                                                className='responsive-select-option'
                                                            >
                                                            {notificationOptions.map(option => (
                                                                <Select.Option 
                                                                    key={option.value} 
                                                                    value={option.value}
                                                                >
                                                                    {option.label}
                                                                </Select.Option>
                                                            ))}
                                                            </Select>
                                                        </Form.Item>
                                                    </Col>

                                                    {formData.notificationType === 'violation' && (
                                                        <>
                                                            {/*Info Pet*/}
                                                            <Col xs={24} sm={24} md={12} lg={8} xl={6} className='col-request'>
                                                                <Form.Item
                                                                    label="Mã số thú cưng"
                                                                    name="petId"
                                                                    rules={[
                                                                        {
                                                                            required: true,
                                                                            message: "Mã số thú cưng là bắt buộc",
                                                                        },
                                                                    ]}
                                                                    labelCol={{ span: 24 }}
                                                                >
                                                                    <Select
                                                                        labelInValue
                                                                        showSearch
                                                                        loading={loading}
                                                                        onChange={(value) => handleSelectChange(value, 'petId')}
                                                                        optionFilterProp="label"
                                                                        filterOption={(input, option) => 
                                                                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                                                        }
                                                                        placeholder="Vui lòng chọn mã số thú cưng"
                                                                        options={petOptions}
                                                                        className='responsive-select-option'
                                                                        >
                                                                        {petOptions.map(option => (
                                                                            <Select.Option 
                                                                            key={option.value} 
                                                                            value={option.value}
                                                                            label={option.label}
                                                                            >
                                                                            {option.label}
                                                                            </Select.Option>
                                                                        ))}
                                                                    </Select>
                                                                </Form.Item>
                                                            </Col>

                                                            {/* Owner Information */}
                                                            <Col xs={24} sm={24} md={12} lg={8} xl={6} className='col-request'>
                                                                    <Form.Item
                                                                        required
                                                                        label="Họ và tên chủ nuôi"
                                                                        labelCol={{ span: 24 }}
                                                                    >
                                                                        <Input 
                                                                            value={ownerInfo.fullName}
                                                                            readOnly
                                                                            placeholder='Tự động điền khi chọn mã thú cưng'
                                                                        />
                                                                    </Form.Item>
                                                            </Col>

                                                            {/*Request Mobile*/}
                                                            <Col xs={24} sm={24} md={12} lg={8} xl={6} className='col-request'>
                                                                <Form.Item
                                                                    required
                                                                    label="Số điện thoại"
                                                                    labelCol={{ span: 24 }}
                                                                >
                                                                    <Input 
                                                                        value={ownerInfo.phone}
                                                                        readOnly
                                                                        placeholder='Tự động điền khi chọn mã thú cưng'
                                                                    />
                                                                </Form.Item>
                                                            </Col>

                                                            {/* Violation Location */}
                                                            <Col xs={24} sm={24} md={12} lg={8} xl={6} className='col-request'>
                                                                <Form.Item
                                                                    label="Địa điểm vi phạm"
                                                                    name="violationLocation"
                                                                    rules={[
                                                                        {
                                                                            required: true,
                                                                            message: "Địa điểm vi phạm là bắt buộc",
                                                                        },
                                                                    ]}
                                                                    labelCol={{ span: 24 }}
                                                                >
                                                                    <Input 
                                                                        placeholder='Vui lòng nhập địa điểm vi phạm'
                                                                        type='text' 
                                                                        name='violationLocation' 
                                                                        onChange={handleInputChange} 
                                                                    />
                                                                </Form.Item>
                                                            </Col>

                                                            {/* Violation Time */}
                                                            <Col xs={24} sm={24} md={12} lg={8} xl={6} className='col-request'>
                                                                <Form.Item
                                                                    label="Thời gian vi phạm"
                                                                    name="violationTime"
                                                                    rules={[
                                                                        {
                                                                            required: true,
                                                                            message: "Thời gian vi phạm là bắt buộc",
                                                                        },
                                                                    ]}
                                                                    labelCol={{ span: 24 }}
                                                                >
                                                                    <DatePicker
                                                                        className='add-request-width-formitem'
                                                                        onChange={(value) => handleDatePicker(value, 'violationTime')}
                                                                        showTime
                                                                        format="DD/MM/YYYY HH:mm"
                                                                        placeholder="Thời gian vi phạm"
                                                                    />
                                                                </Form.Item>
                                                            </Col>

                                                            {/* Description */}
                                                            <Col xs={24} sm={24} md={12} lg={8} xl={6} className='col-request'>
                                                                <Form.Item
                                                                    label="Miêu tả vi phạm"
                                                                    name="description"
                                                                    rules={[
                                                                        {
                                                                            required: true,
                                                                            message: "Vui lòng nhập miêu tả vi phạm",
                                                                        },
                                                                    ]}
                                                                    labelCol={{ span: 24 }}
                                                                >
                                                                    <Input 
                                                                        type='text' 
                                                                        name="description" 
                                                                        onChange={handleInputChange}
                                                                        placeholder='Vui lòng nhập mô tả vi phạm'
                                                                    >
                                                                    </Input>
                                                                </Form.Item>
                                                            </Col>

                                                            {/* Notes */}
                                                            <Col xs={24} sm={24} md={12} lg={8} xl={6} className='col-request'>
                                                                <Form.Item
                                                                    label="Ghi chú"
                                                                    name="notes"
                                                                    labelCol={{ span: 24 }}
                                                                >
                                                                    <Input 
                                                                        type='text' 
                                                                        name="notes" 
                                                                        onChange={handleInputChange}
                                                                        placeholder='Vui lòng nhập ghi chú'
                                                                    >
                                                                    </Input>
                                                                </Form.Item>
                                                            </Col>

                                                            <Col span={24} className='col-request'>
                                                                <div className='Attachment'>
                                                                    <b>Hình ảnh minh chứng</b>
                                                                </div>
                                                            </Col>
                                                                
                                                            <Col span={24} className='col-request'>
                                                                <div className='reply-upload-comment' style={{ width: 'fit-content' }}>
                                                                    <Upload
                                                                        className='upload-attachment-addrequest'
                                                                        beforeUpload={(file) => {
                                                                            const isJpgOrPng = file.type === 'image/jpeg' || file.type === 'image/png';
                                                                            if (!isJpgOrPng) {
                                                                              message.error('Chỉ cho phép file định dạng .JPG/.JPEG/.PNG!');
                                                                              return Upload.LIST_IGNORE;
                                                                            }
                                                                        
                                                                            const isLt10M = file.size / 1024 / 1024 < 10;
                                                                            if (!isLt10M) {
                                                                              message.error('Kích thước file phải nhỏ hơn 10MB!');
                                                                              return Upload.LIST_IGNORE;
                                                                            }
                                                                        
                                                                            handleBeforeUpload(file); // đẩy file vào danh sách fileList
                                                                            return false; // ngăn Antd tự upload
                                                                        }}
                                                                        accept=".png,.jpg,.jpeg"                                                                        
                                                                        fileList={fileList}
                                                                        onRemove={handleRemoveFile}
                                                                        multiple={true}
                                                                    >
                                                                        <Button 
                                                                            icon={<UploadOutlined />}
                                                                            className='btn-attachment-comment'
                                                                        >
                                                                            <b>Tệp đính kèm</b>
                                                                        </Button>
                                                                        <span className='attention-upload-attachment'> (Chỉ chấp nhận file ảnh .png, .jpg, .jpeg, tối đa 10MB)</span>
                                                                    </Upload>
                                                                </div>
                                                            </Col>
                                                        </>
                                                    )}

                                                    {formData.notificationType === 'vaccination' && (
                                                        <>
                                                            {/* Vaccine Type */}
                                                            <Col xs={24} sm={24} md={12} lg={8} xl={6} className='col-request'>
                                                                <Form.Item
                                                                    required
                                                                    label="Loại vaccine"
                                                                    rules={[{ required: true, message: "Loại vaccine là bắt buộc" }]}
                                                                    labelCol={{ span: 24 }}
                                                                >
                                                                    <Input 
                                                                        name="vaccineType"
                                                                        placeholder="VD: Vaccine phòng dại"
                                                                        type='text' 
                                                                        onChange={handleInputChange} 
                                                                    />
                                                                </Form.Item>
                                                            </Col>

                                                            {/* Vaccine address */}
                                                            <Col xs={24} sm={24} md={12} lg={8} xl={6} className='col-request'>
                                                                <Form.Item
                                                                    required
                                                                    label="Địa điểm tiêm"
                                                                    rules={[{ required: true, message: "Địa điểm tiêm là bắt buộc" }]}
                                                                    labelCol={{ span: 24 }}
                                                                >
                                                                    <Input 
                                                                        name="vaccineLocation"
                                                                        placeholder="VD: Trạm thú y phường 5, Quận 10"
                                                                        type='text' 
                                                                        onChange={handleInputChange} 
                                                                    />
                                                                </Form.Item>
                                                            </Col>

                                                            {/* Cost */}
                                                            <Col xs={24} sm={24} md={12} lg={8} xl={6} className='col-request'>
                                                                <Form.Item
                                                                    label="Chi phí (nếu có)"
                                                                    rules={[{ required: true, message: "Chi phí là bắt buộc" }]}
                                                                    labelCol={{ span: 24 }}
                                                                >
                                                                    <Input
                                                                        name="cost"
                                                                        placeholder="VD: 150000 (VND)"
                                                                        type='number'
                                                                        onChange={handleInputChange}
                                                                    />
                                                                </Form.Item>
                                                            </Col>

                                                            {/* Vaccine From */}
                                                            <Col xs={24} sm={24} md={12} lg={8} xl={6} className='col-request'>
                                                                <Form.Item
                                                                    label="Từ ngày"
                                                                    name="vaccineFrom"
                                                                    rules={[{ required: true, message: "Thời gian là bắt buộc" }]}
                                                                    labelCol={{ span: 24 }}
                                                                >
                                                                    <DatePicker
                                                                        className='add-request-width-formitem'
                                                                        onChange={(value) => handleDatePicker(value, 'vaccineFrom')}
                                                                        showTime
                                                                        format="DD/MM/YYYY HH:mm"
                                                                        placeholder="Thời gian từ lúc"
                                                                    />
                                                                </Form.Item>
                                                            </Col>

                                                            {/* Vaccine To */}
                                                            <Col xs={24} sm={24} md={12} lg={8} xl={6} className='col-request'>
                                                                <Form.Item
                                                                    label="Đến ngày"
                                                                    name="vaccineTo"
                                                                    rules={[{ required: true, message: "Thời gian là bắt buộc" }]}
                                                                    labelCol={{ span: 24 }}
                                                                >
                                                                    <DatePicker
                                                                        className='add-request-width-formitem'
                                                                        onChange={(value) => handleDatePicker(value, 'vaccineTo')}
                                                                        showTime
                                                                        format="DD/MM/YYYY HH:mm"
                                                                        placeholder="Thời gian đến lúc"
                                                                    />
                                                                </Form.Item>
                                                            </Col>
                                                            
                                                            {/* Notes */}
                                                            <Col xs={24} sm={24} md={12} lg={8} xl={6} className='col-request'>
                                                                <Form.Item
                                                                    label="Ghi chú"
                                                                    name="notes"
                                                                    labelCol={{ span: 24 }}
                                                                >
                                                                    <Input 
                                                                        type='text' 
                                                                        name="notes" 
                                                                        onChange={handleInputChange}
                                                                        placeholder='Vui lòng nhập ghi chú'
                                                                    >
                                                                    </Input>
                                                                </Form.Item>
                                                            </Col>

                                                            {/* Issuing Agency */}
                                                            <Col xs={24} sm={24} md={12} lg={8} xl={6} className='col-request'>
                                                                <Form.Item
                                                                    required
                                                                    label="Cơ quan ban hành"
                                                                    rules={[{ required: true, message: "Cơ quan ban hành là bắt buộc" }]}
                                                                    labelCol={{ span: 24 }}
                                                                >
                                                                    <Input
                                                                        name="issuingAuthority"
                                                                        placeholder="VD: Trung tâm thú y Quận 10"
                                                                        type='text'
                                                                        onChange={handleInputChange}
                                                                    />
                                                                </Form.Item>
                                                            </Col>
                                                        </>
                                                    )}
                                                </Row>
                                            </Form>
                                        </div>
                                    </div>
                                    {formData.notificationType === 'vaccination' && (
                                        <>
                                            <h3>Gửi đến: </h3>
                                            <SendApprover departmentId={formData.DepartmentId} fileList={fileList} setFileList={setFileList} applyNote={applyNote} setApplyNote={setApplyNote} listOfUserId={listOfUserId} setListOfUserId={setListOfUserId} />
                                        </>
                                    )}
                                </>
                            )}

                    </div>
                </div>
            )
            }
        </RequestLayout >
    );
}

export default AddRequest;