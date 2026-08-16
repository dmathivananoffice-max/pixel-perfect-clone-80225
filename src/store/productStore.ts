import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProductId } from "@/config/products";

interface ProductState {
  selectedProductId: ProductId;
  setProduct: (id: ProductId) => void;
}

export const useProductStore = create<ProductState>()(
  persist(
    (set) => ({
      selectedProductId: "all",
      setProduct: (id) => set({ selectedProductId: id }),
    }),
    { name: "workforce-product" },
  ),
);
