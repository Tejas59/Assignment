import { Route, Routes } from "react-router-dom";
import ChatInput from "../components/ChatInput";

const Routing = () => {
  return (
    <Routes>
      <Route path="/" element={<ChatInput />} />
    </Routes>
  );
};

export default Routing;
