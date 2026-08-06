import { useParams } from "react-router";

export function useGraphPageData() {
  const { customerId } = useParams();
  return {
    customerId: customerId ? Number(customerId) : null,
  };
}
