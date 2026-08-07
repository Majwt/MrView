import { useEffect, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type { Customer } from "@/features/graph/types";
import { fetchAllCustomers, fetchCurrentCustomer } from "@/api/customer-api";
import { useLocation, useNavigate, useParams } from "react-router";
import { Building2, Check, ChevronsUpDown, Network } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

function SidebarCustomerSelect() {
  const { role, customerId: authenticatedCustomerId } = useAuth();
  const { customerId: routeCustomerId } = useParams();
  const { isMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const request = role === "Admin"
      ? fetchAllCustomers().then(setCustomers)
      : role === "Customer"
        ? fetchCurrentCustomer().then(setCurrentCustomer)
        : Promise.resolve();

    request
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [role]);

  const selectedCustomerId = routeCustomerId == null ? null : Number(routeCustomerId);
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const isGraphPage = location.pathname.endsWith("/graph") || location.pathname === "/graph";
  const page = isGraphPage ? "graph" : "dashboard";

  const selectCustomer = (customerId: number | null) => {
    setOpen(false);
    if (isMobile) setOpenMobile(false);
    navigate(customerId == null ? `/${page}` : `/customer/${customerId}/${page}`);
  };

  const identity = role === "Admin"
    ? {
        name: selectedCustomer?.name ?? (selectedCustomerId == null ? "All Customers" : `Customer ${selectedCustomerId}`),
        detail: selectedCustomerId == null ? "Admin view" : "Customer view",
      }
    : {
        name: currentCustomer?.name ?? (error ? "Customer unavailable" : `Customer ${authenticatedCustomerId ?? ""}`),
        detail: "Customer view",
      };

  const identityContent = (
    <>
      <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
        {role === "Admin" && selectedCustomerId == null ? <Network /> : <Building2 />}
      </div>
      <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{identity.name}</span>
        <span className="truncate text-xs text-muted-foreground">{identity.detail}</span>
      </div>
      {role === "Admin" && <ChevronsUpDown className="ml-auto" />}
    </>
  );

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {role === "Admin" ? (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                {identityContent}
              </SidebarMenuButton>
            </PopoverTrigger>
            <PopoverContent
              className="w-(--radix-popover-trigger-width) min-w-64 p-0"
              align="start"
              side={isMobile ? "bottom" : "right"}
              sideOffset={4}
            >
              <Command>
                <CommandInput placeholder="Search customers..." />
                <CommandList>
                  <CommandEmpty>{error ? "Customers could not be loaded." : "No customers found."}</CommandEmpty>
                  <CommandGroup heading="Scope">
                    <CommandItem value="All Customers" onSelect={() => selectCustomer(null)}>
                      <Network />
                      All Customers
                      {selectedCustomerId == null && <Check className="ml-auto" />}
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                  <CommandGroup heading="Customers">
                    {loading && <CommandItem disabled>Loading customers...</CommandItem>}
                    {error && <CommandItem disabled>Customers could not be loaded.</CommandItem>}
                    {customers.map((customer) => (
                      <CommandItem
                        key={customer.id}
                        value={`${customer.name} ${customer.id}`}
                        onSelect={() => selectCustomer(customer.id)}
                      >
                        <Building2 />
                        <span className="truncate">{customer.name}</span>
                        {customer.id === selectedCustomerId && <Check className="ml-auto" />}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <SidebarMenuButton asChild size="lg">
            <div>{identityContent}</div>
          </SidebarMenuButton>
        )}
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
export default SidebarCustomerSelect;
