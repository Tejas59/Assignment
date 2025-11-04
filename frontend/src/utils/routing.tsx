import { Route, Routes } from "react-router-dom";
import Home from "@/components/Home";

const Routing = () => {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
    </Routes>
  );
};

export default Routing;
