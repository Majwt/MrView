import { useEffect, useState } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { Customer } from "@/features/graph/types";
import { fetchAllCustomers } from "@/api/customer-api";
import { useNavigate } from "react-router";

function SidebarCustomerSelect() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedValue, setSelectedValue] = useState("");

  const [customers, setCustomers] = useState<Customer[]>([]);


  useEffect(() => {

    fetchAllCustomers()
      .then((data) => {
        setCustomers(data);
      })
  }, [])




  return (
    <Command className="rounded-md border mt-4" value={selectedValue} onValueChange={setSelectedValue}>
      <CommandInput placeholder="Search customers..." value={searchTerm} onValueChange={setSearchTerm} />
      <CommandList onMouseLeave={() => setSelectedValue("")}>
        <CommandEmpty>No customers found.</CommandEmpty>
        <CommandGroup heading="Customers">
          {customers.map((customer) => (
            <CommandItem key={customer.id} onSelect={() => navigate(`/customer/${customer.id}`)}>
              {customer.name}
            </CommandItem>
          ))}
        </CommandGroup>

      </CommandList>

    </Command>


  )

}
export default SidebarCustomerSelect;
