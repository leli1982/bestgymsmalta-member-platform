import StaffCameraCaptureBridge from "@/components/staff/StaffCameraCaptureBridge";
import StaffEmployeesAdmin from "@/components/staff/StaffEmployeesAdmin";
import "./staff-payroll.css";

export default function StaffAdminPage() {
  return <div className="staff-payroll-ui"><StaffCameraCaptureBridge /><StaffEmployeesAdmin /></div>;
}
