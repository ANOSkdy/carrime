import { StepTransition } from '@/components/layout/StepTransition';

export default function Template({ children }: { children: React.ReactNode }) {
  return <StepTransition>{children}</StepTransition>;
}
