import ChatInput from "./ChatInput";

const Home = () => {
  return (
    <div className="flex h-screen overflow-hidden">
      <div className="flex flex-1 flex-col relative md:ml-64 ml-0 p-4 md:p-10 lg:p-6">
        <header className="fixed top-0 left-6 right-6 z-10 flex h-14 items-center justify-between shadow-lg bg-background">
          <div className="w-full max-w-4xl mx-auto px-4 flex justify-center text-center items-center">
            Hello
          </div>
        </header>

        <div className="fixed left-0 mb-4 right-0 bottom-0 mx-auto flex px-4 justify-center items-center md:pl-10">
          <ChatInput />
        </div>
      </div>
    </div>
  );
};

export default Home;
