import { JSX, useEffect, useState } from 'react';
import { DeleteOutlined, DragOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons';
import { Form, Select, Button, Row, Col, Input, Space, notification } from 'antd';
import './sendApprover.css';
import { RcFile } from 'antd/es/upload';
import { NotificationPlacement } from 'antd/es/notification/interface';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

interface DepartmentMember {
    OwnerId: string;
    FullName: string;
    Email: string;
    PetId: string;
    PetName: string;
}

interface PropsDataList {
    fileList: RcFile[];
    setFileList: React.Dispatch<React.SetStateAction<RcFile[]>>;
    applyNote: boolean;
    setApplyNote: React.Dispatch<React.SetStateAction<boolean>>;
    listOfUserId: string[];
    setListOfUserId: React.Dispatch<React.SetStateAction<string[]>>;
    departmentId: string;
}

function SendApprover({ fileList, setFileList, applyNote, setApplyNote, listOfUserId, setListOfUserId, departmentId }: PropsDataList): JSX.Element {

    const [dataDepartmentMember, setDataDepartmentMember] = useState<DepartmentMember[]>([]);
    const [inputs, setInputs] = useState<string[]>([]);
    const [editingIndex, setEditingIndex] = useState(-1);
    const [counterApprover, setCounterApprover] = useState(1);
    const [labelApprovers, setLabelApprovers] = useState<string[]>([]);
    const [searchValue, setSearchValue] = useState<string>('');
    const [initialValueApprover, setInitialValueApprover] = useState<string[]>([]);

    const { Option } = Select;

    const handleAddInput = () => {
        setInputs([...inputs, '' + counterApprover]);
        setLabelApprovers([...labelApprovers, "Người nhận " + counterApprover]);
        setCounterApprover(counterApprover + 1);
    };

    const handleDelete = (index: number) => {
        const newInputs = [...inputs];
        newInputs.splice(index, 1);
        setInputs(newInputs);

        const newListOfUser = [...listOfUserId];
        newListOfUser.splice(index, 1);
        setListOfUserId(newListOfUser);

        const newInitiValueApprover = [...initialValueApprover];
        newInitiValueApprover.splice(index, 1);
        setInitialValueApprover(newInitiValueApprover);
    };

    const handleInputChangeApprover = (index: number, value: string) => {
        const newApprovers = [...labelApprovers];
        newApprovers[index] = value;
        setLabelApprovers(newApprovers);
    };

    const handleSave = (index: number) => {
        setEditingIndex(-1);
    };

    const handleEdit = (index: number) => {
        setEditingIndex(index);
    };

    const handleSelectChange = (index: number, e: any) => {
        const value = e.value;
        if (listOfUserId.includes(value)) {
            openNotification('topRight');
            return;
        }

        const newListOfUser = [...listOfUserId];
        newListOfUser[index] = value;
        setListOfUserId(newListOfUser);

        const selected = dataDepartmentMember.find(d => `${d.OwnerId}|${d.PetId}` === value);
        if (selected) {
            const label = `${selected.FullName} - ${selected.Email} - ${selected.PetName} (${selected.PetId})`;
            const newInitialValues = [...initialValueApprover];
            newInitialValues[index] = label;
            setInitialValueApprover(newInitialValues);
        }
    };

    const openNotification = (placement: NotificationPlacement) => {
        notification.info({
            message: <strong>Approver already exists</strong>,
            description: 'Cặp chủ nuôi - vật nuôi này đã được chọn, vui lòng chọn cặp khác.',
            placement,
        });
    };

    const handleSearch = (inputValue: string) => {
        setSearchValue(inputValue);
    };

    const filteredData = () => {
        return dataDepartmentMember.filter(
            (pair) => !listOfUserId.includes(`${pair.OwnerId}|${pair.PetId}`) && (
                pair.FullName.toLowerCase().includes(searchValue.toLowerCase()) ||
                pair.Email.toLowerCase().includes(searchValue.toLowerCase()) ||
                pair.PetId.toLowerCase().includes(searchValue.toLowerCase()) ||
                pair.PetName.toLowerCase().includes(searchValue.toLowerCase())
            )
        );
    };

    useEffect(() => {
        const fetchData = async () => {
            const db = getFirestore();
            const ownersSnap = await getDocs(collection(db, 'owners'));
            const petsSnap = await getDocs(collection(db, 'pets'));

            const ownersMap = new Map<string, { fullName: string; email: string }>();
            ownersSnap.forEach(doc => {
                const data = doc.data();
                ownersMap.set(doc.id, {
                    fullName: data.fullName || '',
                    email: data.email || ''
                });
            });

            const pairs: DepartmentMember[] = [];
            petsSnap.forEach(doc => {
                const data = doc.data();
                const ownerId = data.ownerId;
                if (ownerId && ownersMap.has(ownerId)) {
                    pairs.push({
                        OwnerId: ownerId,
                        FullName: ownersMap.get(ownerId)!.fullName,
                        Email: ownersMap.get(ownerId)!.email,
                        PetId: doc.id,
                        PetName: data.name || '(Không tên)'
                    });
                }
            });

            setDataDepartmentMember(pairs);
        };

        fetchData();
    }, []);

    return (
        <div>
            <div className='form-approver'>
                <div className='add-approvers'>
                    <Form>
                        <Row gutter={16}>
                            {inputs.map((input, index) => (
                                <Col xs={24} sm={24} md={12} lg={12} xl={8} key={index} className='col-request '>
                                    <Form.Item
                                        label={
                                            <div className='label-approver'>
                                                {editingIndex === index ? (
                                                    <Space>
                                                        <Input value={labelApprovers[index]} onChange={(e) => handleInputChangeApprover(index, e.target.value)} />
                                                        <Button type="link" onClick={() => handleSave(index)} icon={<SaveOutlined />} />
                                                    </Space>
                                                ) : (
                                                    <Space>
                                                        <div className='responsive-lable-approver'><span title={labelApprovers[index]}>{labelApprovers[index]}</span></div>
                                                        <div className='responsive-btn-approver'>
                                                            <Button type="link" icon={<DeleteOutlined />} onClick={() => handleDelete(index)} />
                                                            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(index)} />
                                                            <Button type="link" icon={<DragOutlined />} />
                                                        </div>
                                                    </Space>
                                                )}
                                            </div>
                                        }
                                        name={inputs[index]}
                                        rules={[{ required: true, message: 'Vui lòng chọn một người nhận!' }]}
                                        initialValue={initialValueApprover[index] ?? '--Chọn người nhận--'}
                                        labelCol={{ span: 24 }}
                                        className='responsive-send-approver'
                                    >
                                        <Select
                                            labelInValue
                                            virtual={false}
                                            onChange={(value) => handleSelectChange(index, value)}
                                            showSearch
                                            optionFilterProp="children"
                                            filterOption={false}
                                            onSearch={handleSearch}
                                            className='responsive-select-option'
                                        >
                                            {filteredData().map((member, idx) => (
                                                <Option key={`${member.OwnerId}|${member.PetId}`} value={`${member.OwnerId}|${member.PetId}`}>
                                                    <div className='responsive-limit-width-ellipsis'>
                                                        <div><strong>{member.FullName}</strong> {member.Email}</div>
                                                        <div style={{ color: 'gray' }}>🐾 {member.PetName} (ID: {member.PetId})</div>
                                                    </div>
                                                </Option>
                                            ))}
                                        </Select>
                                    </Form.Item>
                                </Col>
                            ))}
                            <Col xs={24} sm={24} md={12} lg={12} xl={8} className='btn-add-approver'>
                                <Button
                                    type="primary"
                                    onClick={handleAddInput}
                                    style={{ backgroundColor: 'rgb(47,133,239)', color: 'white' }}
                                >
                                    Thêm
                                </Button>
                            </Col>
                        </Row>
                    </Form>
                </div>
            </div>
        </div>
    );
}

export default SendApprover;