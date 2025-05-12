import { Button, Modal, Select } from 'antd'
import React, { useState } from 'react'
import "./index.css";
import { db } from "../../Firebase/FirebaseConfig"; 
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { message } from 'antd'; 

const Feedback = () => {
    const [isModalOpenFeedback, setIsModalOpenFeedback] = useState(false);
    const [feedbackContent, setFeedbackContent] = useState('');

    const showModalFeedbacks = () => {
        setIsModalOpenFeedback(true);
    }

    const handleSend = async () => {
        if (!feedbackContent.trim()) {
            message.warning("Vui lòng nhập nội dung phản hồi.");
            return;
        }
    
        try {
            const now = new Date();
            const createdAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T` +
                              `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    
            await addDoc(collection(db, "feedbacks"), {
                content: feedbackContent,
                createdAt: createdAt,
            });
    
            message.success("Phản hồi của bạn đã được gửi thành công!");
            setFeedbackContent('');
            setIsModalOpenFeedback(false);
        } catch (error) {
            console.error("Lỗi gửi phản hồi:", error);
            message.error("Đã xảy ra lỗi khi gửi phản hồi.");
        }
    };
       
    const handleCancel = () => {
        setIsModalOpenFeedback(false);
    }

    return (
        <>
            <div className='feedback-title' style={{ textDecoration: 'none', cursor: 'pointer' }} onClick={showModalFeedbacks}>
                <p>Phản hồi</p>
            </div>
            <Modal 
                className='feedback-content' 
                closable={false} 
                title={<h3>Góp ý hệ thống quản lý thú cưng</h3>}  
                open={isModalOpenFeedback} 
                onCancel={handleCancel} 
                footer={
                    <div >
                        <p>
                            Đây là hệ thống tiếp nhận ý kiến cho nền tảng quản lý chó mèo ứng dụng công nghệ IoT. 
                            Bạn có thể gửi đề xuất cải tiến, báo cáo lỗi hoặc góp ý liên quan đến định danh thú cưng, 
                            theo dõi hành vi vi phạm, xử phạt hoặc thông báo tiêm phòng. Những phản hồi có giá trị 
                            sẽ được đội ngũ kỹ thuật ghi nhận và phản hồi trong thời gian sớm nhất.
                        </p>
                        <textarea
                            rows={8}
                            cols={50}
                            value={feedbackContent}
                            onChange={(e) => setFeedbackContent(e.target.value)}
                        ></textarea>
                        <br />
                        <Button onClick={handleSend}>Gửi</Button>
                    </div>
                }>
            </Modal>
        </>
    )
}


export default Feedback