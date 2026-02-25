import React from 'react';
import { Group, Rect, Transformer, Text } from 'react-konva';

const Element = ({ shapeProps, isSelected, onSelect, onChange, trRef }) => {
  const shapeRef = React.useRef();

  React.useEffect(() => {
    if (isSelected) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected, trRef]);

  return (
    <React.Fragment>
      <Group
        onClick={onSelect}
        onTap={onSelect}
        ref={shapeRef}
        {...shapeProps}
        draggable
        onDragEnd={(e) => {
          onChange({
            ...shapeProps,
            x: Math.round(e.target.x() / 20) * 20,
            y: Math.round(e.target.y() / 20) * 20,
          });
        }}
        onTransformEnd={(e) => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          node.scaleX(1);
          node.scaleY(1);
          onChange({
            ...shapeProps,
            x: node.x(),
            y: node.y(),
            width: Math.max(5, node.width() * scaleX),
            height: Math.max(5, node.height() * scaleY),
            rotation: node.rotation(),
          });
        }}
      >
        <Rect
          width={shapeProps.width}
          height={shapeProps.height}
          fill={shapeProps.fill}
          stroke={isSelected ? "#2563eb" : "#1e293b"}
          strokeWidth={isSelected ? 3 : 1}
          cornerRadius={4}
          opacity={0.8}
          shadowBlur={isSelected ? 10 : 0}
        />
        <Text
          text={shapeProps.name}
          fontSize={12}
          width={shapeProps.width}
          align="center"
          padding={10}
          fill="white"
        />
      </Group>
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </React.Fragment>
  );
};

export default Element;