import { useIdentity } from "@/hooks/useIdentity";
import Welcome from "./Welcome";
import Home from "./Home";

const Index = () => {
  const { identity, loading } = useIdentity();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="size-12 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    );
  }

  return identity ? <Home /> : <Welcome />;
};

export default Index;
