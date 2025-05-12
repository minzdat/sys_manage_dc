import { Button, DatePicker, FormInstance, Input, Select } from 'antd';
import dayjs from 'dayjs';
import React, { useState } from 'react'
import { Form } from "antd";

interface FilterFormProps {
    setLoading: (value: boolean) => void;
    handleClear: () => void;
    onApply: () => void;
    setFilter: React.Dispatch<React.SetStateAction<{
        requestCode: string;
        createdFrom: string;
        createdTo: string;
        senderId: string;
        filterStatus: string;
    }>>;
    form: FormInstance<any>;
    setStatus: any;
}

interface User {
    Id: string;
    FirstName: string;
    LastName: string;
}

const FilterForm: React.FC<FilterFormProps> = ({
    setFilter,
    handleClear,
    form,
    setStatus,
    onApply,
}) => {

    const createdFrom = () => {
        const date = dayjs().subtract(1, 'year');
        return date.format('MM/DD/YYYY');
    };
    const createdTo = () => {
        const date = dayjs();
        return date.format('MM/DD/YYYY');
    };
    const [dataUser, setDataUser] = useState<User[]>([]);
    const [FormcreatedFrom, FormsetCreatedFrom] = useState("");
    const [FormcreatedTo, formSetCreatedTo] = useState("");

    const handleSetFormFilter = (values: any) => {
        setFilter((prevFilter) => ({
            ...prevFilter,
            requestCode: values.requestCode === undefined ? "" : values.requestCode,
            createdFrom: FormcreatedFrom,
            createdTo: FormcreatedTo,
            senderId: values.createdBy === "Tất cả" ? "" : values.createdBy,
            filterStatus: values.status === "Tất cả yêu cầu" ? "" : values.status
        }))
        setStatus(values.status === "Tất cả yêu cầu" ? "" : values.status);
    }

    return (
        <Form
            form={form}
            onFinish={(values) => handleSetFormFilter(values)}
            className="filter-form"
            initialValues={{ createdBy: "Tất cả", status: "Tất cả yêu cầu" }}
        >
            <p style={{ fontWeight: "bold", fontFamily: "Segoe UI" }}>Bộ lọc</p>
            <Form.Item>
                <Button
                    type="primary"
                    htmlType="submit"
                    onClick={onApply}
                    style={{
                        color: "white",
                        backgroundColor: "#5cb85c",
                        fontFamily: "Segoe UI",
                    }}
                >
                    Áp dụng
                </Button>
                <Button
                    htmlType="button"
                    style={{
                        color: "#5cb85c",
                        border: "none",
                        marginLeft: "20px",
                        fontFamily: "Segoe UI",
                    }}
                    onClick={handleClear}
                >
                    Xóa
                </Button>
                <hr style={{ border: "1px solid gray" }} />
            </Form.Item>
            <Form.Item name="requestCode" label="Mã yêu cầu" style={{ fontWeight: 'bold', fontFamily: 'Segoe UI' }}>
                <Input placeholder="Từ khóa"/>
            </Form.Item>
            <Form.Item name="created" label="Thời gian" style={{ fontWeight: 'bold', fontFamily: 'Segoe UI' }}>
                <DatePicker.RangePicker
                    defaultValue={[dayjs(createdFrom()), dayjs(createdTo())]}
                    onChange={(_, dateString) => {
                        FormsetCreatedFrom(dateString[0]);
                        formSetCreatedTo(dateString[1]);
                    }}
                />
            </Form.Item>
            <Form.Item name="createdBy" label="Người tạo" initialValue={dataUser.length > 0 ? dataUser[0].FirstName : undefined} style={{ fontWeight: 'bold', fontFamily: 'Segoe UI' }}>
                <Select
                    showSearch
                    optionFilterProp="children"
                    filterOption={(inputValue, option) =>
                        option?.props.children?.toLowerCase().indexOf(inputValue.toLowerCase()) !== -1
                    }
                >
                    <Select.Option value="">Tất cả</Select.Option>
                    {dataUser.map((items) => (
                        <Select.Option key={items.Id} value={items.Id} >
                            {`${items.FirstName} ${items.LastName}`}
                        </Select.Option>
                    ))}
                </Select>
            </Form.Item>
            <Form.Item name="status" label="Trạng thái" style={{ fontWeight: 'bold', fontFamily: 'Segoe UI' }}>
                <Select
                    showSearch
                    optionFilterProp="children"
                    filterOption={(inputValue, option) =>
                        option?.props.children?.toLowerCase().indexOf(inputValue.toLowerCase()) !== -1
                    }
                >
                    <Select.Option value="">Tất cả yêu cầu</Select.Option>
                    <Select.Option value="Draft">Bản nháp</Select.Option>
                    <Select.Option value="Waiting for approval">Chờ phê duyệt</Select.Option>
                    <Select.Option value="Approved">Đã phê duyệt</Select.Option>
                    <Select.Option value="Rejected">Từ chối</Select.Option>
                    <Select.Option value="Canceled">Đã hủy</Select.Option>
                    <Select.Option value="Done">Hoàn thành</Select.Option>
                </Select>
            </Form.Item>
        </Form>
    );
};

export default FilterForm