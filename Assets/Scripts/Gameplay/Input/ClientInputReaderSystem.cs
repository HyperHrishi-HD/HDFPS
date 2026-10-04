using Unity.Entities;
using Unity.MP_FPS;
using Unity.Mathematics;
using Unity.NetCode;
using Unity.Transforms;
using UnityEngine;
using UnityEngine.InputSystem;

[UpdateInGroup(typeof(GhostInputSystemGroup))]
public partial class ClientInputReaderSystem : SystemBase
{
    private float2 _accumulatedLook;
    private Entity _lastKnownPlayerEntity = Entity.Null;
    private bool _prevMobileJump;
    private bool _prevMobileReload;
    private Vector2 _leftStickOrigin;
    private bool _leftStickActive;

    protected override void OnUpdate()
    {
        GameplayInputState.Tick(SystemAPI.Time.DeltaTime);

        Entity currentLocalPlayer = Entity.Null;
        float3 playerPosition = float3.zero;

        foreach (var (transform, ghost, owner, entity) in SystemAPI.Query<
                         RefRO<LocalTransform>,
                         RefRO<PredictedPlayerGhost>,
                         RefRO<GhostOwnerIsLocal>>()
                     .WithEntityAccess())
        {
            currentLocalPlayer = entity;
            playerPosition = transform.ValueRO.Position;
            break;
        }

        if (currentLocalPlayer != Entity.Null)
        {
            if (currentLocalPlayer != _lastKnownPlayerEntity)
            {
                float3 directionToOrigin = math.normalizesafe(new float3(0, 0, -12) - playerPosition);
                float yawRadians = math.atan2(directionToOrigin.x, directionToOrigin.z);
                _accumulatedLook = new float2(math.degrees(yawRadians), 0f);
                _lastKnownPlayerEntity = currentLocalPlayer;
            }
        }
        else
        {
            _lastKnownPlayerEntity = Entity.Null;
        }

        foreach (var (input, movementInput) in SystemAPI.Query<RefRW<ClientInput>, RefRW<ClientMovementInput>>())
        {
            input.ValueRW = new ClientInput();
            movementInput.ValueRW = new ClientMovementInput();

            var playerInput = new PlayerInput();
            if (!GameplayInputState.ShouldBlockGameplayInput())
            {
                GatherGameplayInput(ref playerInput);
            }

            input.ValueRW.SetInput(0, playerInput);
            movementInput.ValueRW.SetInput(0, playerInput);
        }

        GameplayInputState.MobileReloadPressed = false;
    }

    private void GatherGameplayInput(ref PlayerInput playerInput)
    {
        var controls = GameInput.Actions;
        var settings = GameSettings.Instance;
        float mouseSensitivity = settings != null ? settings.MouseSensitivity : 3.7f;
        float stickSensitivity = settings != null ? settings.GamepadLookSensitivity : 140f;
        bool invertY = settings != null && settings.InvertY;
        float dt = SystemAPI.Time.DeltaTime;

        float2 moveVector = float2.zero;
        bool jump = false;
        bool shoot = false;
        bool reload = false;
        bool sprint = false;

        if (controls != null)
        {
            moveVector = (float2)controls.Player.Move.ReadValue<Vector2>();
            if (math.lengthsq(moveVector) < 0.0001f)
            {
                moveVector = (float2)controls.FPS.Move.ReadValue<Vector2>();
            }

            var mouseDelta = (float2)controls.Player.LookDelta.ReadValue<Vector2>();
            ApplyLookDelta(mouseDelta * mouseSensitivity, invertY);

            jump = controls.Player.Jump.triggered || controls.FPS.Jump.triggered;
            shoot = controls.FPS.ShootSingle.IsPressed() || controls.Player.Attack.IsPressed();
            reload = controls.FPS.Reload.triggered;
            sprint = controls.Player.Sprint.IsPressed();
        }

        if (Gamepad.current != null)
        {
            var pad = Gamepad.current;
            var stickMove = (float2)pad.leftStick.ReadValue();
            if (math.lengthsq(stickMove) > math.lengthsq(moveVector))
            {
                moveVector = stickMove;
            }

            ApplyLookDelta((float2)pad.rightStick.ReadValue() * stickSensitivity * dt, invertY);

            jump |= pad.buttonSouth.wasPressedThisFrame;
            shoot |= pad.rightTrigger.isPressed || pad.rightShoulder.isPressed;
            reload |= pad.buttonWest.wasPressedThisFrame;
            sprint |= pad.leftStickButton.isPressed || pad.leftTrigger.isPressed;
        }

        SampleTouchControls(ref moveVector, mouseSensitivity, invertY);

        jump |= GameplayInputState.MobileJumpHeld && !_prevMobileJump;
        shoot |= GameplayInputState.MobileFireHeld;
        reload |= GameplayInputState.MobileReloadPressed && !_prevMobileReload;
        sprint |= GameplayInputState.MobileSprintHeld;

        _prevMobileJump = GameplayInputState.MobileJumpHeld;
        _prevMobileReload = GameplayInputState.MobileReloadPressed;

        var recoil = GameplayInputState.ConsumeRecoil();
        _accumulatedLook.x += recoil.x;
        _accumulatedLook.y += invertY ? recoil.y : -recoil.y;
        _accumulatedLook.y = math.clamp(_accumulatedLook.y, -85f, 85f);

        playerInput.MoveInput = math.length(moveVector) > 1f ? math.normalizesafe(moveVector) : moveVector;
        playerInput.LookYawPitchDegrees = _accumulatedLook;
        playerInput.SetFlag(PlayerInput.InputFlag.Jump, jump);
        playerInput.SetFlag(PlayerInput.InputFlag.Shoot, shoot);
        playerInput.SetFlag(PlayerInput.InputFlag.Reload, reload);
        playerInput.SetFlag(PlayerInput.InputFlag.Sprint, sprint);
    }

    private void ApplyLookDelta(float2 lookDelta, bool invertY)
    {
        _accumulatedLook.x += lookDelta.x;
        _accumulatedLook.y += invertY ? lookDelta.y : -lookDelta.y;
        _accumulatedLook.y = math.clamp(_accumulatedLook.y, -85f, 85f);
    }

    private void SampleTouchControls(ref float2 moveVector, float mouseSensitivity, bool invertY)
    {
        var touchscreen = Touchscreen.current;
        if (touchscreen == null)
        {
            _leftStickActive = false;
            return;
        }

        float halfWidth = Screen.width * 0.5f;
        bool leftStickTouched = false;

        for (int i = 0; i < touchscreen.touches.Count; i++)
        {
            var touch = touchscreen.touches[i];
            if (!touch.press.isPressed)
            {
                continue;
            }

            var pos = touch.position.ReadValue();
            if (pos.x < halfWidth)
            {
                if (!_leftStickActive)
                {
                    _leftStickOrigin = pos;
                    _leftStickActive = true;
                }

                leftStickTouched = true;
                var stick = Vector2.ClampMagnitude((pos - _leftStickOrigin) / 110f, 1f);
                moveVector = new float2(stick.x, stick.y);
            }
            else
            {
                ApplyLookDelta((float2)touch.delta.ReadValue() * mouseSensitivity * 0.12f, invertY);
            }
        }

        if (!leftStickTouched)
        {
            _leftStickActive = false;
        }
    }
}
