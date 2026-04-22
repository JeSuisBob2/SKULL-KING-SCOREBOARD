import { QRCodeSVG } from 'qrcode.react';

interface Props {
  value: string;
  size?: number;
}

export default function QRCodeDisplay({ value, size = 200 }: Props) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="p-3 bg-white rounded-2xl shadow-lg">
        <QRCodeSVG value={value} size={size} />
      </div>
    </div>
  );
}
