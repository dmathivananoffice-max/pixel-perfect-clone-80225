import { useProductStore } from "@/store/productStore";
import { PRODUCTS, getProduct, type ProductId } from "@/config/products";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductSelector() {
  const selectedProductId = useProductStore((s) => s.selectedProductId);
  const setProduct = useProductStore((s) => s.setProduct);
  const active = getProduct(selectedProductId);
  const Icon = active.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <span className={cn("p-1 rounded", active.accent)}>
            <Icon className="w-4 h-4" />
          </span>
          <span className="font-medium">{active.label}</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Switch Product</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {PRODUCTS.map((p) => {
          const PIcon = p.icon;
          const isActive = p.id === selectedProductId;
          return (
            <DropdownMenuItem
              key={p.id}
              onClick={() => setProduct(p.id as ProductId)}
              className="gap-2 cursor-pointer"
            >
              <span className={cn("p-1 rounded", p.accent)}>
                <PIcon className="w-4 h-4" />
              </span>
              <span className="flex-1">{p.label}</span>
              {isActive && <Check className="w-4 h-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
