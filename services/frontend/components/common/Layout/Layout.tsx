import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import cn from 'clsx'
import s from './Layout.module.css'
import { useUI } from '@components/ui/context'
import { Navbar, Footer } from '@components/common'
import ShippingView from '@components/checkout/ShippingView'
import CartSidebarView from '@components/cart/CartSidebarView'
import { Sidebar, Button, LoadingDots } from '@components/ui'
import PaymentMethodView from '@components/checkout/PaymentMethodView'
import CheckoutSidebarView from '@components/checkout/CheckoutSidebarView'
import OrderConfirmView from '@components/checkout/OrderConfirmView'
import { CheckoutProvider } from '@components/checkout/context'
import { MenuSidebarView } from '@components/common/UserNav'
import Discount from '@components/common/Discount'
import Ad from '@components/common/Ad'
import type { Page } from '@customTypes/page'
import type { Link as LinkProps } from '../UserNav/MenuSidebarView'
import type { ReactNode } from 'react'

const Loading = () => (
  <div className="w-80 h-80 flex items-center text-center justify-center p-3">
    <LoadingDots />
  </div>
)

const FeatureBar = lazy(() => import('@components/common/FeatureBar'))
const Modal = lazy(() => import('@components/ui/Modal'))

interface Props {
  pageProps?: any
  children?: ReactNode
}

const ModalView: React.FC<{ modalView: string; closeModal(): any }> = ({
  modalView,
  closeModal,
}) => {
  return (
    <Suspense fallback={<Loading />}>
      <Modal onClose={closeModal}>
        {/* {modalView === 'LOGIN_VIEW' && <LoginView />} */}
        {/* {modalView === 'SIGNUP_VIEW' && <SignUpView />}
        {modalView === 'FORGOT_VIEW' && <ForgotPassword />} */}
      </Modal>
    </Suspense>
  )
}

const ModalUI: React.FC = () => {
  const { displayModal, closeModal, modalView } = useUI()
  return displayModal ? (
    <ModalView modalView={modalView} closeModal={closeModal} />
  ) : null
}

const SidebarView: React.FC<{
  sidebarView: string
  closeSidebar(): any
  links?: LinkProps[]
}> = ({ sidebarView, closeSidebar, links = [] }) => {
  return (
    <Sidebar onClose={closeSidebar}>
      {sidebarView === 'CART_VIEW' && <CartSidebarView />}
      {sidebarView === 'SHIPPING_VIEW' && <ShippingView />}
      {sidebarView === 'PAYMENT_VIEW' && <PaymentMethodView />}
      {sidebarView === 'CHECKOUT_VIEW' && <CheckoutSidebarView />}
      {sidebarView === 'MOBILE_MENU_VIEW' && <MenuSidebarView links={links} />}
      {sidebarView === 'ORDER_CONFIRM_VIEW' && <OrderConfirmView />}
    </Sidebar>
  )
}

const SidebarUI: React.FC = () => {
  const { displaySidebar, closeSidebar, sidebarView } = useUI()
  return displaySidebar ? (
    <SidebarView sidebarView={sidebarView} closeSidebar={closeSidebar} />
  ) : null
}

const Layout: React.FC<Props> = ({ children, pageProps }) => {
  const [pages, setPages] = useState<Page[]>([])

  useEffect(() => {
    getLinks()
  }, [])

  async function getLinks() {
    try {
      const baseUrl = '/api'

      const res = await fetch(`${baseUrl}/pages`)

      if (!res.ok) {
        throw res
      }

      const pages: Page[] = await res.json()

      setPages(pages)
    } catch (errorRes) {
      const error = await errorRes.json()
      console.error(error)
    }
  }

  return (
    <div className={cn(s.root)}>
      <Navbar />
      <Discount />
      <main className="fit">{children}</main>
      <Footer pages={pages} />
      <ModalUI />
      <CheckoutProvider>
        <SidebarUI />
      </CheckoutProvider>
    </div>
  )
}

export default Layout
